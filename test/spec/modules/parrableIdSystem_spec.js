import { expect } from 'chai';
import { config } from 'src/config.js';
import * as utils from 'src/utils.js';
import { init, requestBidsHook, setSubmoduleRegistry } from 'modules/userId/index.js';
import { parrableIdSubmodule } from 'modules/parrableIdSystem.js';
import { newStorageManager } from 'src/storageManager.js';
import { getRefererInfo } from 'src/refererDetection.js';

import { server } from 'test/mocks/xhr';

const storage = newStorageManager();

const EXPIRED_COOKIE_DATE = 'Thu, 01 Jan 1970 00:00:01 GMT';
const P_COOKIE_NAME = '_parrable_eid';
const P_COOKIE_EID = '01.1563917337.test-eid';
const P_XHR_EID = '01.1588030911.test-new-eid'
const P_CONFIG_MOCK = {
  name: 'parrableId',
  params: {
    partner: 'parrable_test_partner_123,parrable_test_partner_456'
  },
  storage: {
    name: '_parrable_eid',
    type: 'cookie',
    expires: 364
  }
};

describe('Parrable ID System', function() {
  function getConfigMock() {
    return {
      userSync: {
        syncDelay: 0,
        userIds: [P_CONFIG_MOCK]
      }
    }
  }

  function getAdUnitMock(code = 'adUnit-code') {
    return {
      code,
      mediaTypes: {banner: {}, native: {}},
      sizes: [
        [300, 200],
        [300, 600]
      ],
      bids: [{
        bidder: 'sampleBidder',
        params: { placementId: 'banner-only-bidder' }
      }]
    };
  }

  describe('parrableIdSystem.getId()', function() {
    let submoduleCallback;
    let callbackSpy = sinon.spy();

    beforeEach(function() {
      submoduleCallback = parrableIdSubmodule.getId(
        P_CONFIG_MOCK.params,
        null,
        P_COOKIE_EID
      ).callback;
      callbackSpy.reset();
    });

    it('returns a callback used to refresh the ID', function() {
      expect(submoduleCallback).to.be.a('function');
    });

    it('invoked callback creates an xhr request to Parrable with id and telemetry', function() {
      submoduleCallback(callbackSpy);

      let request = server.requests[0];
      let queryParams = utils.parseQS(request.url.split('?')[1]);
      let data = JSON.parse(atob(queryParams.data));

      expect(request.url).to.contain('h.parrable.com/prebid');
      expect(data).to.deep.equal({
        eid: P_COOKIE_EID,
        trackers: P_CONFIG_MOCK.params.partner.split(','),
        url: getRefererInfo().referer
      });
    });

    it('callback responds with updated eid from Parrable backend', function() {
      submoduleCallback(callbackSpy);
      server.requests[0].respond(200,
        { 'Content-Type': 'text/plain' },
        JSON.stringify({ eid: P_XHR_EID })
      );
      expect(callbackSpy.calledWith(P_XHR_EID)).to.be.true;
    });
  });

  describe('Parrable ID in Bid Request', function() {
    let adUnits;

    beforeEach(function() {
      adUnits = [getAdUnitMock()];
      // simulate existing browser local storage values
      storage.setCookie(
        P_COOKIE_NAME,
        P_COOKIE_EID,
        (new Date(Date.now() + 5000).toUTCString())
      );
      setSubmoduleRegistry([parrableIdSubmodule]);
      init(config);
      config.setConfig(getConfigMock());
    });

    afterEach(function() {
      storage.setCookie(P_COOKIE_NAME, '', EXPIRED_COOKIE_DATE);
    });

    it('provides the parrableid in the bid request', function(done) {
      requestBidsHook(function() {
        adUnits.forEach(unit => {
          unit.bids.forEach(bid => {
            expect(bid).to.have.deep.nested.property('userId.parrableid');
            expect(bid.userId.parrableid).to.equal(P_COOKIE_EID);
          });
        });
        done();
      }, { adUnits });
    });
  });
});

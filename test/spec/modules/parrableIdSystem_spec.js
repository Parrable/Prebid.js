import { expect } from 'chai';
import {config} from 'src/config';
import * as utils from 'src/utils';
import events from 'src/events';
import CONSTANTS from 'src/constants.json';
import { init, requestBidsHook, setSubmoduleRegistry } from 'modules/userId/index.js';
import { parrableIdSubmodule } from 'modules/parrableIdSystem.js';
import { newStorageManager } from 'src/storageManager.js';

const storage = newStorageManager();

import {server} from 'test/mocks/xhr';

const EXPIRED_COOKIE_DATE = 'Thu, 01 Jan 1970 00:00:01 GMT';
const P_COOKIE_NAME = '_parrable_eid';
const P_COOKIE_VALUE = 'eid%3A01.1563917337.test-eid';
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

  describe('Parrable ID in Bid Request', function() {
    let adUnits;

    beforeEach(function() {
      adUnits = [getAdUnitMock()];
      window.__uspapi = function(cmd, v, cb) {
        if (v === 1) {
          const mockResponse = {
            version: 1,
            uspString: '1YNN'
          };
          cb(mockResponse, true);
        }
      };
    });

    afterEach(function() {
      delete window.__uspapi;
    })

    it('should append parrableid to bid request', function(done) {
      // simulate existing browser local storage values
      storage.setCookie(
        P_COOKIE_NAME,
        P_COOKIE_VALUE,
        (new Date(Date.now() + 5000).toUTCString())
      );

      setSubmoduleRegistry([parrableIdSubmodule]);
      init(config);
      config.setConfig(getConfigMock());

      requestBidsHook(function() {
        adUnits.forEach(unit => {
          unit.bids.forEach(bid => {
            expect(bid).to.have.deep.nested.property('userId.parrableid');
            expect(bid.userId.parrableid).to.equal('01.1563917337.test-eid');
          });
        });
        storage.setCookie(P_COOKIE_NAME, '', EXPIRED_COOKIE_DATE);

        events.emit(CONSTANTS.EVENTS.AUCTION_END, {});
        expect(server.requests[0].url).to.include('&us_privacy=1YNN');
        done();
      }, { adUnits });
    });
  });
});

/**
 * This module adds Parrable to the User ID module
 * The {@link module:modules/userId} module is required
 * @module modules/parrableIdSystem
 * @requires module:modules/userId
 */

import * as utils from '../src/utils.js'
import {ajax} from '../src/ajax.js';
import {submodule} from '../src/hook.js';

const PARRABLE_URL = 'https://h.parrable.com/prebid';

function isValidConfig(configParams) {
  if (!configParams) {
    utils.logError('User ID - parrableId submodule requires configParams');
    return false;
  }
  if (!configParams.partner) {
    utils.logError('User ID - parrableId submodule requires partner list');
    return false;
  }
  return true;
}

function serializeParrableId(idObj) {
  if (!idObj.eid) return '';

  let str = 'eid:' + idObj.eid;
  if (idObj.ibaOptout) {
    str += ',ibaOptout:1';
  }
  if (idObj.ccpaOptout) {
    str += ',ccpaOptout:1';
  }
  return encodeURIComponent(str);
}

function deserializeParrableId(value) {
  const idObj = {};
  const values = decodeURIComponent(value).split(',');

  values.forEach(function(value) {
    const obj = value.split(':');
    idObj[obj[0]] = +obj[1] === 1 ? true : obj[1];
  });

  return idObj;
}

function fetchId(configParams, consentData, currentStoredId) {
  if (!isValidConfig(configParams)) return;

  const data = {
    eid: (currentStoredId && deserializeParrableId(currentStoredId).eid) || null,
    trackers: configParams.partner.split(',')
  };

  const searchParams = {
    data: btoa(JSON.stringify(data)),
    _rand: Math.random()
  };

  const options = {
    method: 'GET',
    withCredentials: true
  };

  const callback = function (cb) {
    const onSuccess = (response) => {
      let idObj = {};
      if (response) {
        try {
          let responseObj = JSON.parse(response);
          if (responseObj) {
            idObj = {
              ibaOptout: responseObj.ibaOptout,
              ccpaOptout: responseObj.ccpaOptout,
              eid: responseObj.eid
            };
          }
        } catch (error) {
          utils.logError(error);
        }
      }
      cb(serializeParrableId(idObj));
    };
    ajax(PARRABLE_URL, onSuccess, searchParams, options);
  };

  return { callback };
};

/** @type {Submodule} */
export const parrableIdSubmodule = {
  /**
   * used to link submodule with config
   * @type {string}
   */
  name: 'parrableId',
  /**
   * decode the stored id value for passing to bid requests
   * @function
   * @param {object} idObj
   * @return {object}
   */
  decode(value) {
    return { parrableid: deserializeParrableId(value) };
  },

  /**
   * performs action to obtain id and return a value in the callback's response argument
   * @function
   * @param {SubmoduleParams} [configParams]
   * @param {ConsentData} [consentData]
   * @returns {function(callback:function)}
   */
  getId(configParams, consentData, currentStoredId) {
    return fetchId(configParams, consentData, currentStoredId);
  }
};

submodule('userId', parrableIdSubmodule);

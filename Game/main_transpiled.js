#!/bin/env node
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

/* eslint indent: off, no-case-declarations: off */

// Attach external modules


var _redux;

function _load_redux() {
  return _redux = require('redux');
}

var _dumper;

function _load_dumper() {
  return _dumper = require('dumper');
}

var _defaultState;

function _load_defaultState() {
  return _defaultState = _interopRequireDefault(require('./defaultState'));
}

var _listOfActions;

function _load_listOfActions() {
  return _listOfActions = _interopRequireDefault(require('./updates/listOfActions'));
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

const turnDelay = 1000;

// Helper functions
// Get new action object without 'type' property
const refineAction = action => Object.keys(action).filter(key => key !== 'type').reduce((obj, key) => {
  obj[key] = action[key];
  return obj;
}, {});

// Get new state object with provided changes on state.world object
const changeWorld = (state, changeObject) => {
  const { world } = state;

  return _extends({}, state, {
    world: _extends({}, world, changeObject)
  });
};

// Get new playerList object without given player
const removePlayer = (playerList, playerId) => playerList.filter(p => p.playerId !== playerId);

// Get new single player object with provided changes
const getModifiedPlayer = (playerList, playerId, _ref) => {
  let changes = _objectWithoutProperties(_ref, []);

  return _extends({}, playerList.find(p => p.playerId === playerId), changes);
};

// Get new playerList object with updates for a given player
const updatePlayer = (playerList, updatedPlayer) => removePlayer(playerList, updatedPlayer.playerId).concat(updatedPlayer);

// Get new playerList object with moved player
const movePlayer = (playerList, playerId, x, y) => updatePlayer(playerList, getModifiedPlayer(playerList, playerId, { x, y }));

// Get new playerList object with weapon change for a given player
const changeWeapon = (playerList, playerId, weapon) => updatePlayer(playerList, getModifiedPlayer(playerList, playerId, { weapon }));

// Get new playerList object with lowered hp for a given player
const takeDamage = (playerList, attackerId, targetId, weapons) => {
  const { hp } = playerList.find(p => p.playerId === targetId);

  const { weapon } = playerList.find(p => p.playerId === attackerId);

  const { damage } = weapons.find(({ name }) => name === weapon);

  return updatePlayer(playerList, getModifiedPlayer(playerList, targetId, { hp: hp - damage }));
};

/* eslint no-unused-vars: off */
// Validation functions
const isAlive = (state, playerId) => {
  const { world: { playerList } } = state;
  const { hp } = playerList.find(p => p.playerId === playerId) || { hp: 0 };

  return hp > 0;
};

const isLogged = (state, playerId) => state.world.playerList.map(p => p.playerId).includes(playerId);

const isValidClass = (state, pClass) => state.available.classes.map(c => c.name).includes(pClass);

const isValidWeapon = (state, weapon) => state.available.weapons.map(w => w.name).includes(weapon);

const isValidAction = (state, action) => {
  const {
    type,
    playerId,
    hp,
    x,
    y,
    weapon,
    targetId,
    class: pClass
  } = action;

  if (playerId) {
    if (playerId < 0) return false;
    if (type !== 'add player' && !isAlive(state, playerId)) return false;
  }

  switch (type) {
    case 'attack':
      return isAlive(state, targetId);
    case 'add player':
      return isValidClass(state, pClass) && isValidWeapon(state, weapon) && x >= 0 && y >= 0;
    case 'move':
      return x >= 0 && y >= 0;
    case 'change weapon':
      return isValidWeapon(state, weapon);
    case 'game over':
      return true;
    default:
      return false;
  }
};

// Single Reducer
const reducer = (state, action) => {
  if (!action) return state;
  if (!isValidAction(state, action)) return state;

  const { world: { playerList }, available: { weapons } } = state;
  const {
    type,
    playerId,
    x,
    y,
    weapon,
    targetId,
    winner
  } = action;

  switch (type) {
    case 'add player':
      return changeWorld(_extends({}, state, { lastAction: action }), { playerList: playerList.concat(refineAction(action)) });

    case 'move':
      return changeWorld(_extends({}, state, { lastAction: action }), { playerList: movePlayer(playerList, playerId, x, y) });

    case 'change weapon':
      return changeWorld(_extends({}, state, { lastAction: action }), { playerList: changeWeapon(playerList, playerId, weapon) });

    case 'attack':
      return changeWorld(_extends({}, state, { lastAction: action }), { playerList: takeDamage(playerList, playerId, targetId, weapons) });

    case 'game over':
      return _extends({}, state, {
        winner,
        lastAction: action
      });

    default:
      return state;
  }
};

const store = (0, (_redux || _load_redux()).createStore)(reducer, (_defaultState || _load_defaultState()).default);

const logger = (state, action) => {
  const { world: { playerList } } = state;
  const {
    type,
    playerId,
    hp,
    x,
    y,
    targetId,
    class: pClass,
    winner
  } = action;

  let { weapon } = action;

  switch (type) {
    case 'attack':
      weapon = playerList.find(p => p.playerId === playerId).weapon;

      if (isAlive(state, targetId)) {
        return `Player ${playerId} attacked player ${targetId} with ${weapon}`;
      } else {
        return `Player ${playerId} killed player ${targetId} with ${weapon}`;
      }
    case 'add player':
      return `Player ${playerId} entered world as ${pClass}`;
    case 'move':
      return `Player ${playerId} moved to position [${x}:${y}]`;
    case 'change weapon':
      return `Player ${playerId} changed his weapon to ${weapon}`;
    case 'game over':
      return `Game Over\nPlayer ${winner} is the winner`;
    default:
      return 'Something indescribable has happened';
  }
};

const colorizeMsg = msg => {
  const colorRules = [{ regex: /killed/i, color: '\x1b[31m' }, { regex: /winner/i, color: '\x1b[33m' }, { regex: /moved/i, color: '\x1b[34m' }, { regex: /changed[\w\s]+weapon/i, color: '\x1b[36m' }, { regex: /attack/i, color: '\x1b[35m' }, { regex: /entered/i, color: '\x1b[32m' }];
  const resetCode = '\x1b[0m';
  const { color } = colorRules.find(rule => rule.regex.test(msg)) || false;

  return color ? `${color}${msg}${resetCode}` : msg;
};

// Subscribe to state changes
const unsubscribe = store.subscribe(() => {
  const state = store.getState();
  const { world: { playerList }, winner, lastAction } = state;

  console.log(colorizeMsg(logger(state, lastAction)));
});

// Emitter helper functions
const getAlivePlayers = playerList => playerList.filter(p => p.hp > 0);

const getDeadPlayers = playerList => playerList.filter(p => p.hp <= 0);

// Run game scenario by building a chain of promises from actions.
// Each promise is a single turn with delay afterwards.
const actionEmitter = (store, turns) => {
  turns.reduce((chain, actions, index) => chain.then(() => new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log(`Turn NO: ${index}`);

      // Emit actions for the current turn
      actions.some(action => {
        store.dispatch(action);

        const { playerList } = store.getState().world;
        const alivePlayers = getAlivePlayers(playerList);

        // Stop emmiting actions if there is only one player left
        if (alivePlayers.length === 1 && getDeadPlayers(playerList).length >= 1) {
          // Define winner
          store.dispatch({ type: 'game over', winner: alivePlayers[0].playerId });
          reject();
          return true;
        }
      });
      resolve();
    }, turnDelay);
  })), Promise.resolve()).then(() => console.log('No Actions Left')).catch(() => console.log('\n<<< The promise chain was interrupted >>>'));
};

actionEmitter(store, (_listOfActions || _load_listOfActions()).default);
#!/bin/env node

/* eslint indent: off, no-case-declarations: off */

// Attach external modules
import { List, Map, fromJS } from 'immutable';
import { createStore } from 'redux';
import { dumper } from 'dumper';

import defaultState from './defaultState';
import turns from './updates/listOfActions';

const turnDelay = 200;


// Helper functions
// Get new action object without 'type' property
const refineAction = action => (
  Object.keys(action)
    .filter(key => key !== 'type')
    .reduce((obj, key) => {
      obj[key] = action[key];
      return obj;
    }, {})
);

// Get new playerList object with moved player
const movePlayer = (playerList, playerId, x, y) => (
  playerList.mergeIn(
    [playerList.findIndex(p => p.get('playerId') === playerId)],
    { x, y }
  )
);

// Get new playerList object with weapon change for a given player
const changeWeapon = (playerList, playerId, weapon) => (
  playerList.mergeIn(
    [playerList.findIndex(p => p.get('playerId') === playerId)],
    { weapon }
  )
);

// Get new playerList object with lowered hp for a given player
const takeDamage = (playerList, attackerId, targetId, weapons) => {
  const hp = playerList.find(p => p.get('playerId') === targetId)
    .get('hp');

  const weapon = playerList.find(p => p.get('playerId') === attackerId)
    .get('weapon');

  const damage = weapons.find(w => w.get('name') === weapon).get('damage');

  return playerList.mergeIn(
    [playerList.findIndex(t => t.get('playerId') === targetId)],
    { hp: hp - damage }
  );
};



/* eslint no-unused-vars: off */
// Validation functions
const isAlive = (state, playerId) => (
  Map.isMap(state) && state.getIn(['world', 'playerList'])
    .find(p => p.get('playerId') === playerId)
    .get('hp') > 0
);

const isLogged = (state, playerId) => (
  state.getIn(['world', 'playerList'])
    .map(p => p.get('playerId'))
    .includes(playerId)
);

const isValidClass = (state, pClass) => (
  state.getIn(['available', 'classes'])
    .map(c => c.get('name'))
    .includes(pClass)
);

const isValidWeapon = (state, weapon) => (
  state.getIn(['available', 'weapons'])
    .map(w => w.get('name'))
    .includes(weapon)
);

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
    if (
      type !== 'add player'
      && !isAlive(state, playerId)
    ) return false;
  }

  switch(type) {
    case 'attack':
      return isAlive(state, targetId);
    case 'add player':
      return isValidClass(state, pClass)
        && isValidWeapon(state, weapon)
        && x >= 0
        && y >= 0;
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

  const playerList = state.getIn(['world', 'playerList']);
  const weapons = state.getIn(['available', 'weapons']);
  const {
    type,
    playerId,
    x,
    y,
    weapon,
    targetId,
    winner
  } = action;

  // TODO: DRY with lastAction merge
  switch(type) {
    case 'add player':
      return state.set('lastAction', Map(action))
        .setIn(
          ['world', 'playerList'],
          playerList.push(Map(refineAction(action)))
        );

    case 'move':
      return state.set('lastAction', Map(action))
        .setIn(
          ['world', 'playerList'],
          movePlayer(playerList, playerId, x, y)
        );

    case 'change weapon':
      return state.set('lastAction', Map(action))
        .setIn(
          ['world', 'playerList'],
          changeWeapon(playerList, playerId, weapon)
        );

    case 'attack':
      return state.set('lastAction', Map(action))
        .setIn(
          ['world', 'playerList'],
          takeDamage(playerList, playerId, targetId, weapons)
        );

    case 'game over':
      return state.set('lastAction', Map(action))
        .set('winner', winner);

    default:
      return state;
  }
};



const logger = state => {
  const playerList = state.getIn(['world', 'playerList']);
  const action = state.get('lastAction').toObject();
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

  switch(type) {
    case 'attack':
      weapon = playerList
        .find(p => p.get('playerId') === playerId)
        .get('weapon');

      if (isAlive(state.toJS(), targetId)) {
        return `Player ${playerId} attacked player ${targetId} with ${weapon}`;
      }
      else {
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
  const colorRules = [
    { regex: /killed/i, color: '\x1b[31m' },
    { regex: /winner/i, color: '\x1b[33m' },
    { regex: /moved/i, color: '\x1b[34m' },
    { regex: /changed[\w\s]+weapon/i, color: '\x1b[36m' },
    { regex: /attack/i, color: '\x1b[35m' },
    { regex: /entered/i, color: '\x1b[32m' },
  ];
  const resetCode = '\x1b[0m';
  const { color } = colorRules.find(rule => rule.regex.test(msg)) || false;

  return color ? `${color}${msg}${resetCode}` : msg;
};



// Emitter helper functions
const getAlivePlayers = playerList => (
  playerList.filter(p => p.get('hp') > 0)
);

const getDeadPlayers = playerList => (
  playerList.filter(p => p.get('hp') <= 0)
);

// Run game scenario by building a chain of promises from actions.
// Each promise is a single turn with delay afterwards.
const actionEmitter = (store, turns) => {
  turns.reduce((chain, actions, index) => (
    chain.then(() => (
      new Promise((resolve, reject) => {
        setTimeout(() => {
          console.log(`Turn NO: ${index}`);

          // Emit actions for the current turn
          actions.some(action => {
            store.dispatch(action);

            const state = store.getState();
            const playerList = state.getIn(['world', 'playerList']);
            const alivePlayers = getAlivePlayers(playerList);

            // Stop emmiting actions if there is only one player left
            if (
              alivePlayers.size === 1
              && getDeadPlayers(playerList).size >= 1
            ) {
              // Define winner
              store.dispatch({ type: 'game over', winner: alivePlayers.getIn([0, 'playerId']) });
              reject();
              return true;
            }
          });
          resolve();
        }, turnDelay);
      })
    ))
  ), Promise.resolve())
    .then(() => console.log('No Actions Left'))
    .catch(() => console.log('\n<<< The promise chain was interrupted >>>'));
};



const store = createStore(reducer, fromJS(defaultState));
// Subscribe to state changes
const unsubscribe = store.subscribe(() => {
  const state = store.getState();

  console.log(colorizeMsg(logger(state)));
});
actionEmitter(store, turns);

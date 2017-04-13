const listOfActions = require('./listOfActions.json');

const subscriptions = [];

function createSubscription(func) {
   let timerId = 0;

   function loop(i) {
      timerId = setTimeout(() => {
         func(listOfActions[i]);

         // if we call unsubscribe from callback
         if (timerId === 0) { return; }

         loop((i + 1) % listOfActions.length);
      }, 1000);
   }

   function start() {
      loop(0);
   }

   function stop() {
      clearTimeout(timerId);
      timerId = 0;
   }

   subscriptions.push({ func, start, stop });

   start();
}

function cancelSubscription(func) {
   const i = subscriptions.findIndex(s => s.func === func);

   if (i > -1) {
      const subscription = subscriptions[i];

      subscription.stop();
      subscriptions.splice(i, 1);
   }
}

function subscribe(cb) {
   createSubscription(cb);
}

function unsubscribe(cb) {
   cancelSubscription(cb);
}

module.exports = { subscribe, unsubscribe };

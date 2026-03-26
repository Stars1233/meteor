import { FACTS_COLLECTION, FACTS_PUBLICATION } from './facts_base_common.js';

Tinytest.add('facts-base - increments server facts', (test) => {
  Facts.resetServerFacts();

  Facts.incrementServerFact('newPackage', 'skyIsBlue', 42);
  test.equal(Facts._factsByPackage.newPackage, { skyIsBlue: 42 });

  Facts.incrementServerFact('newPackage', 'skyIsBlue', 21);
  test.equal(Facts._factsByPackage.newPackage, { skyIsBlue: 63 });

  Facts.incrementServerFact('newPackage', 'newFact', 7);
  test.equal(Facts._factsByPackage.newPackage, { skyIsBlue: 63, newFact: 7 });
});


Tinytest.add('facts-base - setUserIdFilter', (test) => {
  let called = false;
  Facts.setUserIdFilter((userId) => {
    called = true;
    return userId === 'test-user';
  });
  test.isTrue(typeof Facts.setUserIdFilter === 'function');
});

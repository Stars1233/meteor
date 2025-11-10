Tinytest.addAsync("timers - defer", function (test, onComplete) {
  let x = "a";
  Meteor.defer(function () {
    test.equal(x, "b");
    onComplete();
  });
  x = "b";
});

Tinytest.addAsync("timers - nested defer", function (test, onComplete) {
  let x = "a";
  Meteor.defer(function () {
    test.equal(x, "b");
    Meteor.defer(function () {
      test.equal(x, "c");
      onComplete();
    });
    x = "c";
  });
  x = "b";
});

Tinytest.addAsync("timers - deferrable", function (test, onComplete) {
  let x = "a";
  Meteor.deferrable(
    function () {
      test.equal(x, "b");
      onComplete();
    },
    { on: ["development", "production", "test"] }
  );
  x = "b";
});

Tinytest.addAsync(
  "timers - deferrable not in current env",
  function (test, onComplete) {
    let x = "a";
    Meteor.deferrable(
      function () {
        x = "b";
      },
      { on: [] }
    );
    test.equal(x, "b");
  }
);

Tinytest.addAsync(
  "timers - defer works with async functions",
  async function (test, onComplete) {
    let x = "a";
    Meteor.deferrable(
      async function () {
        await new Promise((resolve) => setTimeout(resolve, 10));
        test.equal(x, "b");
        onComplete();
      },
      { on: ["development", "production", "test"] }
    );
    await Meteor.deferrable(async () => (x = "b"), { on: [] });
  }
);

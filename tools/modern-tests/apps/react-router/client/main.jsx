import React from 'react';
import { createRoot } from 'react-dom/client';
import { Meteor } from 'meteor/meteor';
import { App } from '/imports/ui/App';

let root;

Meteor.startup(() => {
  const container = document.getElementById('react-target'); // your container id
  if (!root) {
    root = createRoot(container); // create once
  }
  root.render(<App />);
});

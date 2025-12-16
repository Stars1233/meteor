import { createRoot } from 'react-dom/client';
import { Meteor } from 'meteor/meteor';
import { RouterProvider } from "react-router/dom";
import { Routes } from '/imports/ui/Routes.jsx';
import '/imports/ui/styles.css';

Meteor.startup(() => {
  const container = document.getElementById('react-target');
  const root = createRoot(container);
  root.render(<RouterProvider router={Routes}  />);
});

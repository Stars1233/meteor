import { createBrowserRouter } from "react-router";
import { App } from "./App";
import { About } from "./About";

// https://reactrouter.com/start/data/routing
export const Routes = createBrowserRouter([
  {
    path: "/",
    element: <App />,
  },
  {
    path: "/about",
    element: <About />,
    loader: async () => {
      const about = await Meteor.callAsync('about');
      return { about };
    }
  }
]);
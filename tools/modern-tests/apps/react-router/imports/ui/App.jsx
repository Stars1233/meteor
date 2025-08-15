import React from 'react';
import { createBrowserRouter, RouterProvider, Route, createRoutesFromElements } from 'react-router-dom';
import { Home } from './Home.jsx';
import { NotFound } from './NotFound.jsx';

// Create router with routes
const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="/" element={<Home />} />
      <Route path="*" element={<NotFound />} />
    </>
  )
);

export const App = () => (
  <RouterProvider router={router} />
);

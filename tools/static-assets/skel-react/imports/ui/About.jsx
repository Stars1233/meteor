import { useLoaderData } from "react-router";
import { NavLink } from "react-router";

export const About = () => {
  const { about } = useLoaderData();
  return (
    <div className="about-page">
      <NavLink to="/">Home</NavLink>
      <div className="section">
        <h2>About This Application</h2>
        <NavLink to="/about">Reload this page</NavLink>
      </div>
      <p>{about}</p>
    </div>
  );
}
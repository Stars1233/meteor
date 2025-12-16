import { Counter } from './Counter.jsx';
import { Info } from './Info.jsx';
import { Header } from './Header.jsx';

export const App = () => (
  <div className="home-page">
    <Header/>
    <Counter/>
    <Info/>
  </div>
);

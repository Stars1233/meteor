import { useFind, useSubscribe } from 'meteor/react-meteor-data';
import { LinksCollection } from '../api/links';

export const Info = () => {
  const isLoading = useSubscribe('links');
  const links = useFind(() => LinksCollection.find());

  if (isLoading()) {
    return <div>Loading...</div>;
  }

  return (
    <div>

      <h2>Learn Meteor!</h2>
      <ul className="links-list">{links.map(
        link => <li className='section' key={link._id}>
          <a href={link.url} className="link" target="_blank">{link.title}</a>
        </li>
      )}</ul>
    </div>
  );
};

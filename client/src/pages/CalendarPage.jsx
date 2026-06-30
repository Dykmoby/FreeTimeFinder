import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import CalendarEditor from '../components/CalendarEditor.jsx';
import { makeEditorPlumbing } from '../lib/availabilityClient.js';
import { getLocalTimeZone } from '../lib/tz.js';

export default function CalendarPage() {
  const { user } = useAuth();
  const [people, setPeople] = useState([]); // other users, for the visibility picker

  // Everyone except me — these are the people an interval can be limited to.
  useEffect(() => {
    api('/availability/users')
      .then(({ users }) => setPeople(users.filter((u) => u.id !== user.id)))
      .catch(() => setPeople([]));
  }, [user.id]);

  // My own calendar is edited in my own (auto-detected) timezone.
  const { fetchRange, replaceDay, removeInterval } = useMemo(
    () => makeEditorPlumbing({
      tz: getLocalTimeZone(),
      listPath: '/availability/mine',
      dayPath: '/availability/mine/day',
      delPath: (id) => `/availability/mine/${id}`,
    }),
    [],
  );

  return (
    <CalendarEditor
      heading={<h1 className="page__title">Моё свободное время</h1>}
      people={people}
      fetchRange={fetchRange}
      replaceDay={replaceDay}
      removeInterval={removeInterval}
    />
  );
}

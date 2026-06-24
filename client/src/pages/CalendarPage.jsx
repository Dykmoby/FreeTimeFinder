import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import CalendarEditor from '../components/CalendarEditor.jsx';

export default function CalendarPage() {
  const { user } = useAuth();
  const [people, setPeople] = useState([]); // other users, for the visibility picker

  // Everyone except me — these are the people an interval can be limited to.
  useEffect(() => {
    api('/availability/users')
      .then(({ users }) => setPeople(users.filter((u) => u.id !== user.id)))
      .catch(() => setPeople([]));
  }, [user.id]);

  const fetchRange = useCallback(
    (from, to) => api(`/availability/mine?from=${from}&to=${to}`).then((r) => r.availability),
    [],
  );
  const replaceDay = useCallback(
    (iso, intervals) => api('/availability/mine/day', { method: 'PUT', body: { day: iso, intervals } }),
    [],
  );
  const removeInterval = useCallback(
    (id) => api(`/availability/mine/${id}`, { method: 'DELETE' }),
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

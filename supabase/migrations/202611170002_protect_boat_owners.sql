-- Ein Owner kann nicht versehentlich seine letzte Owner-Mitgliedschaft löschen.
-- Crewmitglieder dürfen weiterhin selbst austreten; Owner dürfen Crew entfernen.

drop policy "Owners can remove crew" on public.boat_memberships;

create policy "Owners can remove crew and crew can leave"
on public.boat_memberships for delete to authenticated
using (
  (public.is_boat_owner(boat_id) and role = 'crew')
  or (user_id = auth.uid() and role = 'crew')
);

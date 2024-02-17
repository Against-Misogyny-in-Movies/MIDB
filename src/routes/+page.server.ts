import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const session = await event.locals.getSession();
  if (!session?.user) redirect(303, '/auth/signin');
  return {};
};
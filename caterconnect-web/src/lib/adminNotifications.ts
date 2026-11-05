import { supabase } from './supabase';

type StaffAdminNotification = {
  title: string;
  message: string;
  type: 'caterer_verification_decision';
};

/** Fan out a saved Staff action to Admin profiles using the current session. */
export async function notifyAdminsOfStaffAction(
  notification: StaffAdminNotification
): Promise<boolean> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw authError ?? new Error('No authenticated user session.');
    }

    const { data: actor, error: actorError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (actorError) throw actorError;
    if (actor?.role !== 'staff') {
      throw new Error('Only an authenticated Staff account can send this notification.');
    }

    const { data: admins, error: adminsError } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin');

    if (adminsError) throw adminsError;
    if (!admins?.length) {
      throw new Error('No Admin profiles were available to receive the notification.');
    }

    const { error: insertError } = await supabase.from('notifications').insert(
      admins.map(({ id }) => ({
        user_id: id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        booking_id: null,
        is_read: false,
      }))
    );

    if (insertError) throw insertError;
    return true;
  } catch (error) {
    console.error('Could not notify Admin users about the Staff action:', error);
    return false;
  }
}

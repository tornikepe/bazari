-- A staff role that can see the dashboard but cannot change anything.
--
-- Added to the existing enum rather than introduced as a separate `canWrite`
-- flag: permission here is one dimension, not two, and a boolean beside a role
-- invites the two to disagree — an `admin` with `canWrite = false` would have
-- no defined meaning.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'viewer';

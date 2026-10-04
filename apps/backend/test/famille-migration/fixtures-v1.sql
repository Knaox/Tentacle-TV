-- Données de la v1 : chaque cas que la v2 interdit.
INSERT INTO families (id, ownerUserId, ownerName, ownerColor, createdAt, updatedAt) VALUES
 ('F1', 'a', REPEAT('A', 120), 'pink', '2026-10-01 10:01:00.000', '2026-10-01 10:01:00.000'),
 ('F2', 'b', 'Bea', NULL, '2026-10-01 10:02:00.000', '2026-10-01 10:02:00.000'),
 ('F3', 'c', 'Cleo', NULL, '2026-10-01 10:03:00.000', '2026-10-01 10:03:00.000'),
 ('F4', 'd', 'Dan', NULL, '2026-10-01 10:04:00.000', '2026-10-01 10:04:00.000'),
 ('F5', 'f', 'Flo', NULL, '2026-10-01 10:05:00.000', '2026-10-01 10:05:00.000'),
 ('F6', 'h', 'Hugo', NULL, '2026-10-01 10:06:00.000', '2026-10-01 10:06:00.000'),
 ('F7', 'j', 'Jade', NULL, '2026-10-01 10:07:00.000', '2026-10-01 10:07:00.000'),
 ('F8', 'k', 'Kim', NULL, '2026-10-01 10:08:00.000', '2026-10-01 10:08:00.000'),
 ('F9', 'l', 'Lou', NULL, '2026-10-01 10:09:00.000', '2026-10-01 10:09:00.000');
INSERT INTO family_members (id, familyId, userId, kind, displayName, color, jellyfinName, createdAt) VALUES
 ('m1', 'F1', 'b', 'member', 'Bea', NULL, NULL, '2026-10-01 10:20:00.000'),
 ('m2', 'F2', 'a', 'member', 'A', NULL, NULL, '2026-10-01 10:21:00.000'),
 ('g0', 'F1', 'guest0', 'guest', 'Zoe', 'teal', 'Zoe - invite de A', '2026-10-01 10:22:00.000'),
 ('m3', 'F3', 'd', 'member', 'Dan', NULL, NULL, '2026-10-01 10:23:00.000'),
 ('m4', 'F4', 'e', 'member', 'Eva', NULL, NULL, '2026-10-01 10:24:00.000'),
 ('g1', 'F4', 'guest1', 'guest', 'Noe', 'blue', 'Noe - invite de Dan', '2026-10-01 10:25:00.000'),
 ('m5', 'F5', 'i', 'member', 'Ines', NULL, NULL, '2026-10-01 10:26:00.000'),
 ('m6', 'F6', 'i', 'member', 'Ines', NULL, NULL, '2026-10-01 10:27:00.000'),
 ('m7', 'F7', 'k', 'member', 'Kim', NULL, NULL, '2026-10-01 10:28:00.000'),
 ('m8', 'F8', 'l', 'member', 'Lou', NULL, NULL, '2026-10-01 10:29:00.000'),
 ('m9', 'F9', 'm', 'member', 'Max', NULL, NULL, '2026-10-01 10:30:00.000');
INSERT INTO family_invitations (id, familyId, ownerUserId, inviteeUserId, inviteeName, status, createdAt, expiresAt) VALUES
 ('inv1', 'F5', 'f', 'a', 'A', 'pending', '2026-10-01 11:00:00.000', '2026-12-01 11:00:00.000'),
 ('inv2', 'F1', 'a', 'n', 'Nils', 'pending', '2026-10-01 11:01:00.000', '2026-12-01 11:00:00.000'),
 ('inv3', 'F4', 'd', 'n', 'Nils', 'pending', '2026-10-01 11:02:00.000', '2026-12-01 11:00:00.000'),
 ('inv4', 'F2', 'b', 'x', 'Xav', 'accepted', '2026-10-01 11:03:00.000', '2026-12-01 11:00:00.000');
INSERT INTO notifications (jellyfinUserId, type, title, refId) VALUES
 ('a', 'family_invite', 'Flo', 'inv1'),
 ('n', 'family_invite', 'A', 'inv2'),
 ('n', 'family_invite', 'Dan', 'inv3'),
 ('a', 'ticket_reply', 'Support', 'inv1');

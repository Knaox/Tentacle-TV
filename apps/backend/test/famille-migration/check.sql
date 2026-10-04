SELECT 'familles', GROUP_CONCAT(id ORDER BY id) FROM families;
SELECT CONCAT('famille ', familyId), GROUP_CONCAT(CONCAT(userId, ':', kind, IF(createdBy IS NULL, '', CONCAT('<', createdBy)), IF(canCreateGuests = 0, '', '+droit')) ORDER BY kind = 'guest', kind <> 'owner', createdAt) FROM family_members GROUP BY familyId ORDER BY familyId;
SELECT 'doublons', COUNT(*) FROM (SELECT userId FROM family_members GROUP BY userId HAVING COUNT(*) > 1) d;
SELECT 'familles sans ligne owner', COUNT(*) FROM families f WHERE NOT EXISTS (SELECT 1 FROM family_members m WHERE m.familyId = f.id AND m.userId = f.ownerUserId AND m.kind = 'owner');
SELECT 'nom du proprietaire F1', LENGTH(displayName) FROM family_members WHERE id = 'owner-F1';
SELECT 'couleur du proprietaire F1', color FROM family_members WHERE id = 'owner-F1';
SELECT 'invitations', GROUP_CONCAT(CONCAT(id, ':', status) ORDER BY id) FROM family_invitations;
SELECT 'cloches', GROUP_CONCAT(CONCAT(jellyfinUserId, ':', type, ':', refId) ORDER BY id) FROM notifications;
SELECT 'index unique userId', COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'family_members' AND INDEX_NAME = 'family_members_userId_key' AND NON_UNIQUE = 0;

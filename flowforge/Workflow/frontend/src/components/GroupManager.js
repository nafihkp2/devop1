// src/components/GroupManager.js
import React, { useState } from 'react';
import axios from 'axios';

const GroupManager = ({ projectId, userId, onGroupCreated }) => {
  const [groupName, setGroupName] = useState('');
  const [members, setMembers] = useState('');

  const createGroup = async (e) => {
    e.preventDefault();
    if (!groupName || !members) return;

    try {
      const response = await axios.post('/create-group', {
        projectId,
        groupName,
        members: members.split(',').map((m) => m.trim()),
        adminId: userId,
      });
      onGroupCreated(response.data);
      setGroupName('');
      setMembers('');
    } catch (error) {
      console.error('Error creating group:', error);
    }
  };

  return (
    <div className="group-manager">
      <h3>Create New Group</h3>
      <form onSubmit={createGroup}>
        <input
          type="text"
          placeholder="Group Name"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Add members (comma-separated user IDs)"
          value={members}
          onChange={(e) => setMembers(e.target.value)}
        />
        <button type="submit">Create Group</button>
      </form>
    </div>
  );
};

export default GroupManager;
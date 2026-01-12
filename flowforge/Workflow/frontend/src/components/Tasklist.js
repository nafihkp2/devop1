import React, { useState, useEffect } from 'react';
import axios from 'axios';

const TaskList = ({ projectId }) => {
    const [tasks, setTasks] = useState([]);
    const [newTask, setNewTask] = useState({ title: '', description: '' });

    useEffect(() => {
        const fetchTasks = async () => {
            try {
                const response = await axios.get(
                    `/api/projects/${projectId}/tasks`
                );
                setTasks(response.data.tasks);
            } catch (error) {
                console.error('Error fetching tasks:', error);
            }
        };
        fetchTasks();
    }, [projectId]);

    const handleStatusChange = async (taskId, newStatus) => {
        try {
            await axios.put(`/api/tasks/${taskId}/status`, { status: newStatus });
            setTasks(tasks.map(task => 
                task.id === taskId ? { ...task, status: newStatus } : task
            ));
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    const handleCreateTask = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post(
                `/api/projects/${projectId}/tasks`,
                newTask
            );
            setTasks([...tasks, { ...newTask, id: response.data.taskId }]);
            setNewTask({ title: '', description: '' });
        } catch (error) {
            console.error('Error creating task:', error);
        }
    };

    return (
        <div className="task-manager">
            <h3>Tasks ({tasks.length})</h3>
            
            {/* Progress Bar */}
            <div className="progress-bar">
                <div 
                    className="progress-fill"
                    style={{ width: `${(tasks.filter(t => t.status === 'completed').length / tasks.length * 100)}%` }}
                >
                    {Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length * 100))}%
                </div>
            </div>

            {/* Task Creation Form */}
            <form onSubmit={handleCreateTask}>
                <input
                    type="text"
                    placeholder="Task title"
                    value={newTask.title}
                    onChange={e => setNewTask({...newTask, title: e.target.value})}
                    required
                />
                <textarea
                    placeholder="Description"
                    value={newTask.description}
                    onChange={e => setNewTask({...newTask, description: e.target.value})}
                />
                <button type="submit">Add Task</button>
            </form>

            {/* Task List */}
            <div className="task-list">
                {tasks.map(task => (
                    <div 
                        key={task.id} 
                        className={`task-item ${task.status}`}
                    >
                        <label>
                            <input
                                type="checkbox"
                                checked={task.status === 'completed'}
                                onChange={e => handleStatusChange(
                                    task.id,
                                    e.target.checked ? 'completed' : 'pending'
                                )}
                            />
                            <span className="checkmark"></span>
                        </label>
                        <div className="task-content">
                            <h4>{task.title}</h4>
                            <p>{task.description}</p>
                            {task.due_date && (
                                <small>Due: {new Date(task.due_date).toLocaleDateString()}</small>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TaskList;
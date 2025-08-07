// Redis客户端配置和API封装
import Redis from 'ioredis';

// Redis连接配置
const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true
};

// 创建Redis实例
export const redis = new Redis(redisConfig);

// API基础URL配置
export const API_BASE_URL = process.env.NODE_ENV === 'production' 
    ? 'https://your-vercel-app.vercel.app/api'
    : 'http://localhost:3000/api';

// Redis API调用封装
export const redisApi = {
    // 联系人相关
    contacts: {
        getAll: async (params = {}) => {
            const response = await fetch(`${API_BASE_URL}/redis-contacts?${new URLSearchParams(params)}`);
            return response.json();
        },
        create: async (data) => {
            const response = await fetch(`${API_BASE_URL}/redis-contacts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return response.json();
        },
        update: async (id, data) => {
            const response = await fetch(`${API_BASE_URL}/redis-contacts?id=${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return response.json();
        },
        delete: async (id) => {
            const response = await fetch(`${API_BASE_URL}/redis-contacts?id=${id}`, {
                method: 'DELETE'
            });
            return response.json();
        }
    },

    // 日程相关
    schedules: {
        getAll: async (params = {}) => {
            const response = await fetch(`${API_BASE_URL}/redis-schedules?${new URLSearchParams(params)}`);
            return response.json();
        },
        create: async (data) => {
            const response = await fetch(`${API_BASE_URL}/redis-schedules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return response.json();
        },
        update: async (id, data) => {
            const response = await fetch(`${API_BASE_URL}/redis-schedules?id=${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return response.json();
        },
        delete: async (id) => {
            const response = await fetch(`${API_BASE_URL}/redis-schedules?id=${id}`, {
                method: 'DELETE'
            });
            return response.json();
        }
    },

    // 项目相关
    projects: {
        getAll: async (params = {}) => {
            const response = await fetch(`${API_BASE_URL}/redis-projects?${new URLSearchParams(params)}`);
            return response.json();
        },
        create: async (data) => {
            const response = await fetch(`${API_BASE_URL}/redis-projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return response.json();
        },
        update: async (id, data) => {
            const response = await fetch(`${API_BASE_URL}/redis-projects?id=${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return response.json();
        },
        delete: async (id) => {
            const response = await fetch(`${API_BASE_URL}/redis-projects?id=${id}`, {
                method: 'DELETE'
            });
            return response.json();
        }
    },

    // 商业机会相关
    opportunities: {
        getAll: async (params = {}) => {
            const response = await fetch(`${API_BASE_URL}/redis-opportunities?${new URLSearchParams(params)}`);
            return response.json();
        },
        create: async (data) => {
            const response = await fetch(`${API_BASE_URL}/redis-opportunities`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return response.json();
        },
        update: async (id, data) => {
            const response = await fetch(`${API_BASE_URL}/redis-opportunities?id=${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return response.json();
        },
        delete: async (id) => {
            const response = await fetch(`${API_BASE_URL}/redis-opportunities?id=${id}`, {
                method: 'DELETE'
            });
            return response.json();
        }
    }
};

// 数据迁移工具
export const migrationTools = {
    // 从LocalStorage迁移联系人数据
    migrateContactsFromLocalStorage: async () => {
        const localContacts = JSON.parse(localStorage.getItem('contacts') || '[]');
        const results = [];
        
        for (const contact of localContacts) {
            try {
                const result = await redisApi.contacts.create(contact);
                results.push({ success: true, contact: result });
            } catch (error) {
                results.push({ success: false, error: error.message, contact });
            }
        }
        
        return results;
    },

    // 从LocalStorage迁移日程数据
    migrateSchedulesFromLocalStorage: async () => {
        const localSchedules = JSON.parse(localStorage.getItem('schedules') || '[]');
        const results = [];
        
        for (const schedule of localSchedules) {
            try {
                const result = await redisApi.schedules.create(schedule);
                results.push({ success: true, schedule: result });
            } catch (error) {
                results.push({ success: false, error: error.message, schedule });
            }
        }
        
        return results;
    },

    // 导出所有数据为JSON
    exportAllData: async () => {
        try {
            const [contacts, schedules, projects, opportunities] = await Promise.all([
                redisApi.contacts.getAll(),
                redisApi.schedules.getAll(),
                redisApi.projects.getAll(),
                redisApi.opportunities.getAll()
            ]);

            const exportData = {
                export_date: new Date().toISOString(),
                version: '1.0',
                data: {
                    contacts: contacts.contacts || [],
                    schedules: schedules.schedules || [],
                    projects: projects.projects || [],
                    opportunities: opportunities.opportunities || []
                }
            };

            // 创建下载链接
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `crm-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);

            return exportData;
        } catch (error) {
            console.error('Export failed:', error);
            throw error;
        }
    }
};

// 连接测试工具
export const testConnection = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/test-redis`);
        return response.json();
    } catch (error) {
        return { success: false, error: error.message };
    }
};
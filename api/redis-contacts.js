// Redis版本 - 联系人管理API
import Redis from 'ioredis';

// Redis连接配置
const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3
});

export default async function handler(req, res) {
    // 设置CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        switch (req.method) {
            case 'GET':
                await getContacts(req, res);
                break;
            case 'POST':
                await createContact(req, res);
                break;
            case 'PUT':
                await updateContact(req, res);
                break;
            case 'DELETE':
                await deleteContact(req, res);
                break;
            default:
                res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('Redis API Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// 获取联系人列表
async function getContacts(req, res) {
    const { search, relationship, limit = 50, offset = 0 } = req.query;
    
    let contactIds;
    
    if (relationship) {
        // 按关系远近筛选
        contactIds = await redis.smembers(`contacts:by_relationship:${relationship}`);
    } else {
        // 获取所有联系人
        contactIds = await redis.smembers('contacts:all');
    }
    
    // 分页
    const startIdx = parseInt(offset);
    const endIdx = startIdx + parseInt(limit);
    const paginatedIds = contactIds.slice(startIdx, endIdx);
    
    // 批量获取联系人详情
    const contacts = [];
    for (const id of paginatedIds) {
        const contact = await redis.hgetall(`contact:${id}`);
        if (contact && contact.name) {
            // 解析JSON字段
            if (contact.investment_preference) {
                contact.investment_preference = JSON.parse(contact.investment_preference);
            }
            if (contact.tags) {
                contact.tags = JSON.parse(contact.tags);
            }
            contact.id = id;
            
            // 搜索过滤
            if (search) {
                const searchLower = search.toLowerCase();
                if (contact.name.toLowerCase().includes(searchLower) ||
                    (contact.company && contact.company.toLowerCase().includes(searchLower)) ||
                    (contact.position && contact.position.toLowerCase().includes(searchLower))) {
                    contacts.push(contact);
                }
            } else {
                contacts.push(contact);
            }
        }
    }
    
    res.status(200).json({ 
        contacts: search ? contacts : contacts.slice(0, parseInt(limit)),
        total: contactIds.length 
    });
}

// 创建新联系人
async function createContact(req, res) {
    const contactData = req.body;
    
    // 数据验证
    if (!contactData.name) {
        return res.status(400).json({ error: 'Name is required' });
    }
    
    // 生成新ID
    const id = await redis.incr('counters:contact_id');
    
    // 准备数据
    const now = new Date().toISOString();
    const contact = {
        ...contactData,
        created_at: now,
        updated_at: now
    };
    
    // 处理JSON字段
    if (contact.investment_preference && Array.isArray(contact.investment_preference)) {
        contact.investment_preference = JSON.stringify(contact.investment_preference);
    }
    if (contact.tags && Array.isArray(contact.tags)) {
        contact.tags = JSON.stringify(contact.tags);
    }
    
    // 存储联系人数据
    await redis.hmset(`contact:${id}`, contact);
    
    // 更新索引
    await redis.sadd('contacts:all', id);
    if (contact.company) {
        await redis.sadd(`contacts:by_company:${contact.company}`, id);
    }
    if (contact.relationship_level) {
        await redis.sadd(`contacts:by_relationship:${contact.relationship_level}`, id);
    }
    
    // 返回结果
    contact.id = id;
    if (contact.investment_preference) {
        contact.investment_preference = JSON.parse(contact.investment_preference);
    }
    if (contact.tags) {
        contact.tags = JSON.parse(contact.tags);
    }
    
    res.status(201).json({ contact });
}

// 更新联系人
async function updateContact(req, res) {
    const { id } = req.query;
    const updateData = req.body;
    
    if (!id) {
        return res.status(400).json({ error: 'Contact ID is required' });
    }
    
    // 检查联系人是否存在
    const exists = await redis.exists(`contact:${id}`);
    if (!exists) {
        return res.status(404).json({ error: 'Contact not found' });
    }
    
    // 获取旧数据用于更新索引
    const oldContact = await redis.hgetall(`contact:${id}`);
    
    // 准备更新数据
    const now = new Date().toISOString();
    const contact = {
        ...updateData,
        updated_at: now
    };
    
    // 处理JSON字段
    if (contact.investment_preference && Array.isArray(contact.investment_preference)) {
        contact.investment_preference = JSON.stringify(contact.investment_preference);
    }
    if (contact.tags && Array.isArray(contact.tags)) {
        contact.tags = JSON.stringify(contact.tags);
    }
    
    // 更新数据
    await redis.hmset(`contact:${id}`, contact);
    
    // 更新索引
    if (oldContact.company && contact.company !== oldContact.company) {
        await redis.srem(`contacts:by_company:${oldContact.company}`, id);
        if (contact.company) {
            await redis.sadd(`contacts:by_company:${contact.company}`, id);
        }
    }
    
    if (oldContact.relationship_level && contact.relationship_level !== oldContact.relationship_level) {
        await redis.srem(`contacts:by_relationship:${oldContact.relationship_level}`, id);
        if (contact.relationship_level) {
            await redis.sadd(`contacts:by_relationship:${contact.relationship_level}`, id);
        }
    }
    
    // 获取完整的更新后数据
    const updatedContact = await redis.hgetall(`contact:${id}`);
    updatedContact.id = id;
    if (updatedContact.investment_preference) {
        updatedContact.investment_preference = JSON.parse(updatedContact.investment_preference);
    }
    if (updatedContact.tags) {
        updatedContact.tags = JSON.parse(updatedContact.tags);
    }
    
    res.status(200).json({ contact: updatedContact });
}

// 删除联系人
async function deleteContact(req, res) {
    const { id } = req.query;
    
    if (!id) {
        return res.status(400).json({ error: 'Contact ID is required' });
    }
    
    // 获取联系人数据用于清理索引
    const contact = await redis.hgetall(`contact:${id}`);
    if (!contact.name) {
        return res.status(404).json({ error: 'Contact not found' });
    }
    
    // 删除数据
    await redis.del(`contact:${id}`);
    
    // 清理索引
    await redis.srem('contacts:all', id);
    if (contact.company) {
        await redis.srem(`contacts:by_company:${contact.company}`, id);
    }
    if (contact.relationship_level) {
        await redis.srem(`contacts:by_relationship:${contact.relationship_level}`, id);
    }
    
    res.status(200).json({ message: 'Contact deleted successfully' });
}
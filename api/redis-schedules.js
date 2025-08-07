// Redis版本 - 日程管理API
import Redis from 'ioredis';

const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3
});

export default async function handler(req, res) {
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
                await getSchedules(req, res);
                break;
            case 'POST':
                await createSchedule(req, res);
                break;
            case 'PUT':
                await updateSchedule(req, res);
                break;
            case 'DELETE':
                await deleteSchedule(req, res);
                break;
            default:
                res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('Redis Schedule API Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// 获取日程列表
async function getSchedules(req, res) {
    const { date, start_date, end_date, urgency } = req.query;
    
    let scheduleKeys = [];
    
    if (date) {
        // 获取特定日期的日程
        const pattern = `schedule:${date}:*`;
        scheduleKeys = await redis.keys(pattern);
    } else if (start_date && end_date) {
        // 获取日期范围内的日程
        const startDate = new Date(start_date);
        const endDate = new Date(end_date);
        
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const pattern = `schedule:${dateStr}:*`;
            const dayKeys = await redis.keys(pattern);
            scheduleKeys = scheduleKeys.concat(dayKeys);
        }
    } else {
        // 默认获取未来7天的日程
        const today = new Date();
        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            const pattern = `schedule:${dateStr}:*`;
            const dayKeys = await redis.keys(pattern);
            scheduleKeys = scheduleKeys.concat(dayKeys);
        }
    }
    
    // 批量获取日程详情
    const schedules = [];
    for (const key of scheduleKeys) {
        const schedule = await redis.hgetall(key);
        if (schedule && schedule.item) {
            // 从key中提取ID
            const keyParts = key.split(':');
            schedule.id = keyParts[keyParts.length - 1];
            
            // 紧急程度过滤
            if (!urgency || schedule.urgency === urgency) {
                schedules.push(schedule);
            }
        }
    }
    
    // 按日期和时间排序
    schedules.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return (a.time_slot || '').localeCompare(b.time_slot || '');
    });
    
    res.status(200).json({ schedules });
}

// 创建新日程
async function createSchedule(req, res) {
    const scheduleData = req.body;
    
    // 数据验证
    if (!scheduleData.date || !scheduleData.item) {
        return res.status(400).json({ error: 'Date and item are required' });
    }
    
    // 生成新ID
    const id = await redis.incr('counters:schedule_id');
    
    // 格式化日期
    const date = new Date(scheduleData.date).toISOString().split('T')[0];
    const timeSlot = scheduleData.time_slot || '09:00';
    
    // 准备数据
    const now = new Date().toISOString();
    const schedule = {
        ...scheduleData,
        date,
        time_slot: timeSlot,
        status: scheduleData.status || 'pending',
        created_at: now,
        updated_at: now
    };
    
    // 生成Redis key
    const scheduleKey = `schedule:${date}:${timeSlot}:${id}`;
    
    // 存储日程数据
    await redis.hmset(scheduleKey, schedule);
    
    // 更新索引
    await redis.sadd(`schedules:by_date:${date}`, scheduleKey);
    if (schedule.urgency) {
        await redis.sadd(`schedules:by_urgency:${schedule.urgency}`, scheduleKey);
    }
    
    // 返回结果
    schedule.id = id;
    res.status(201).json({ schedule });
}

// 更新日程
async function updateSchedule(req, res) {
    const { id } = req.query;
    const updateData = req.body;
    
    if (!id) {
        return res.status(400).json({ error: 'Schedule ID is required' });
    }
    
    // 查找现有的日程key
    const pattern = `schedule:*:${id}`;
    const keys = await redis.keys(pattern);
    
    if (keys.length === 0) {
        return res.status(404).json({ error: 'Schedule not found' });
    }
    
    const scheduleKey = keys[0];
    const oldSchedule = await redis.hgetall(scheduleKey);
    
    // 准备更新数据
    const now = new Date().toISOString();
    const schedule = {
        ...updateData,
        updated_at: now
    };
    
    // 如果日期或时间改变，需要更新key
    let newScheduleKey = scheduleKey;
    if (schedule.date || schedule.time_slot) {
        const newDate = schedule.date ? new Date(schedule.date).toISOString().split('T')[0] : oldSchedule.date;
        const newTimeSlot = schedule.time_slot || oldSchedule.time_slot;
        newScheduleKey = `schedule:${newDate}:${newTimeSlot}:${id}`;
        
        if (newScheduleKey !== scheduleKey) {
            // 删除旧key，创建新key
            await redis.del(scheduleKey);
            await redis.srem(`schedules:by_date:${oldSchedule.date}`, scheduleKey);
            
            // 合并完整数据
            const completeSchedule = { ...oldSchedule, ...schedule };
            await redis.hmset(newScheduleKey, completeSchedule);
            await redis.sadd(`schedules:by_date:${newDate}`, newScheduleKey);
        } else {
            // 只更新数据
            await redis.hmset(scheduleKey, schedule);
        }
    } else {
        // 只更新数据
        await redis.hmset(scheduleKey, schedule);
    }
    
    // 更新紧急程度索引
    if (oldSchedule.urgency && schedule.urgency !== oldSchedule.urgency) {
        await redis.srem(`schedules:by_urgency:${oldSchedule.urgency}`, scheduleKey);
        if (schedule.urgency) {
            await redis.sadd(`schedules:by_urgency:${schedule.urgency}`, newScheduleKey);
        }
    }
    
    // 获取完整的更新后数据
    const updatedSchedule = await redis.hgetall(newScheduleKey);
    updatedSchedule.id = id;
    
    res.status(200).json({ schedule: updatedSchedule });
}

// 删除日程
async function deleteSchedule(req, res) {
    const { id } = req.query;
    
    if (!id) {
        return res.status(400).json({ error: 'Schedule ID is required' });
    }
    
    // 查找日程key
    const pattern = `schedule:*:${id}`;
    const keys = await redis.keys(pattern);
    
    if (keys.length === 0) {
        return res.status(404).json({ error: 'Schedule not found' });
    }
    
    const scheduleKey = keys[0];
    const schedule = await redis.hgetall(scheduleKey);
    
    // 删除数据
    await redis.del(scheduleKey);
    
    // 清理索引
    if (schedule.date) {
        await redis.srem(`schedules:by_date:${schedule.date}`, scheduleKey);
    }
    if (schedule.urgency) {
        await redis.srem(`schedules:by_urgency:${schedule.urgency}`, scheduleKey);
    }
    
    res.status(200).json({ message: 'Schedule deleted successfully' });
}
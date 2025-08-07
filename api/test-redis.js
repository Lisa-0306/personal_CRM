// Redis连接测试API
import Redis from 'ioredis';

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
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        // 测试基本连接
        const testKey = `test:${Date.now()}`;
        const testValue = 'Hello Redis from Vercel!';
        
        // 写入测试
        await redis.set(testKey, testValue);
        
        // 读取测试
        const result = await redis.get(testKey);
        
        // 删除测试数据
        await redis.del(testKey);
        
        // 获取Redis信息
        const info = await redis.info('memory');
        const memoryUsage = info.match(/used_memory_human:(.+)/)?.[1]?.trim() || 'Unknown';
        
        // 测试计数器功能
        const counterTest = await redis.incr('test:counter');
        await redis.del('test:counter');
        
        res.status(200).json({
            success: true,
            message: 'Redis连接成功！',
            test_result: result,
            memory_usage: memoryUsage,
            counter_test: counterTest,
            timestamp: new Date().toISOString(),
            connection_info: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                has_password: !!process.env.REDIS_PASSWORD
            }
        });
        
    } catch (error) {
        console.error('Redis connection test failed:', error);
        
        res.status(500).json({
            success: false,
            error: error.message,
            error_type: error.constructor.name,
            timestamp: new Date().toISOString(),
            connection_info: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                has_password: !!process.env.REDIS_PASSWORD
            }
        });
    }
}
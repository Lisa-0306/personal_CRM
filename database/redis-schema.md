# Redis数据存储设计

## 📊 数据结构设计

### 1. 联系人 (Contacts)
```
Key格式: contact:{id}
数据类型: Hash
字段:
- name: 姓名
- position: 职位
- company: 公司
- phone: 电话
- email: 邮箱
- wechat: 微信
- investment_preference: JSON字符串(投资偏好数组)
- relationship_level: close/medium/distant
- referred_by: 推荐人
- notes: 备注
- tags: JSON字符串(标签数组)
- created_at: 创建时间
- updated_at: 更新时间

索引:
- contacts:all (Set) - 所有联系人ID
- contacts:by_company:{company} (Set) - 按公司分组
- contacts:by_relationship:{level} (Set) - 按关系远近分组
```

### 2. 项目 (Projects)
```
Key格式: project:{id}
数据类型: Hash
字段:
- name: 项目名称
- company: 公司
- stage: initial/dd/ic/invested
- industry: 行业
- amount: 投资金额
- round: 轮次
- valuation: 估值
- status: active/paused/completed/cancelled
- notes: 备注
- created_at: 创建时间
- updated_at: 更新时间

索引:
- projects:all (Set) - 所有项目ID
- projects:by_stage:{stage} (Set) - 按阶段分组
- projects:by_status:{status} (Set) - 按状态分组
```

### 3. 商业机会 (Opportunities)
```
Key格式: opportunity:{id}
数据类型: Hash
字段:
- project_name: 项目名称
- project_type: 项目类型
- project_info: 项目信息
- expected_fee: 可预期收费
- cooperation_target: 合作对象
- recommended_partners: JSON字符串(推荐合作伙伴)
- actual_partners: JSON字符串(已推荐合作伙伴)
- follow_up_status: 跟进状态
- status: active/following/completed/cancelled
- created_at: 创建时间
- updated_at: 更新时间

索引:
- opportunities:all (Set) - 所有机会ID
- opportunities:by_status:{status} (Set) - 按状态分组
```

### 4. 日程 (Schedules)
```
Key格式: schedule:{date}:{time_slot}:{id}
数据类型: Hash
字段:
- date: 日期 (YYYY-MM-DD)
- time_slot: 时间段 (HH:mm)
- item: 事项
- urgency: urgent/high/medium/low
- notes: 备注
- contact_id: 关联联系人ID
- project_id: 关联项目ID
- status: pending/completed/cancelled
- created_at: 创建时间
- updated_at: 更新时间

索引:
- schedules:by_date:{date} (Set) - 按日期分组
- schedules:by_urgency:{urgency} (Set) - 按紧急程度分组
```

### 5. 全局计数器
```
counters:contact_id (String) - 联系人ID计数器
counters:project_id (String) - 项目ID计数器  
counters:opportunity_id (String) - 机会ID计数器
counters:schedule_id (String) - 日程ID计数器
```

## 🔍 查询模式

### 常用查询示例:
```javascript
// 获取所有联系人
SMEMBERS contacts:all

// 获取关系密切的联系人
SMEMBERS contacts:by_relationship:close

// 获取某日期的日程
SMEMBERS schedules:by_date:2024-01-15

// 获取某个联系人详情
HGETALL contact:123

// 搜索联系人（需要在应用层实现）
// 先获取所有ID，再批量查询过滤
```

## 📈 性能估算

### 存储容量 (Redis Cloud免费30MB):
- 3000个联系人 × 1KB ≈ 3MB
- 300个项目 × 0.8KB ≈ 0.24MB  
- 1000个机会 × 1.2KB ≈ 1.2MB
- 10000个日程 × 0.5KB ≈ 5MB
- 索引数据 ≈ 2MB
- **总计**: 约11.5MB (远低于30MB限制)

### 性能优势:
- 读取速度: < 1ms
- 写入速度: < 1ms
- 并发处理: 10万+操作/秒
- 网络延迟: 主要瓶颈

## 🛠️ 技术栈
- **Redis Cloud**: 免费托管Redis服务
- **Vercel API**: Serverless函数处理请求
- **ioredis**: Node.js Redis客户端
- **前端**: 现有personal-crm.html + API调用
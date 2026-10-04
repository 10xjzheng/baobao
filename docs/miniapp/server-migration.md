# 迁移到自有服务器

## 当前隔离边界

页面只调用 `miniprogram/services/repository.js`。当前实现把请求发送到 `babyApi` 云函数；迁移时页面和数据结构不需要整体重写，只需替换 repository 的传输层。

## 推荐目标结构

```text
微信小程序
  -> HTTPS REST API
  -> 服务端微信登录与会话
  -> 自有数据库
```

建议保持以下动作契约：`getDashboard`、`listFeedRecords`、`createFeed`、`listGrowthRecords`、`createGrowth`、`getProfile`、`updateReminder`、`createInvite`、`joinFamily`。

## 迁移步骤

1. 准备已备案 HTTPS 域名和服务器，并在微信公众平台配置服务器域名。
2. 服务端通过微信官方登录流程识别用户；不要接受客户端传入的 openid 作为权限凭证。
3. 在自有数据库建立宝宝、成员、喂奶、成长、提醒和邀请表，并保留 CloudBase 记录 ID 作为迁移追踪字段。
4. 从 CloudBase 控制台导出六个集合，在离线环境校验数量、日期、角色和归属后导入自有数据库。
5. 实现与现有动作契约一致的 HTTPS API，并在服务端重复执行类型、范围、归属、权限和幂等校验。
6. 新增一个 REST repository，与 CloudBase repository 并行进行只读比对；数量和关键汇总一致后再切写入。
7. 短期保留 CloudBase 为只读回退；确认自有服务稳定后再由管理员明确授权停用。

## 数据安全

- 不把 AppSecret、会话密钥或数据库密码放入小程序包。
- 迁移文件应加密保存，完成核验后按备份策略处理。
- 正式切换和停用 CloudBase 都属于高影响操作，需要确认目标环境、备份和恢复方式后单独执行。

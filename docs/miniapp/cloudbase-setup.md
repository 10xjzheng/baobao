# CloudBase 免费模式配置

## 费用硬约束

- 只选择账号当前明确显示为 `0 元` 的体验/免费方案。
- 不开通自动续费、按量付费、短信、AI、云托管、付费存储或其他增值能力。
- 创建环境后立即设置用量和到期提醒；免费期结束前迁移或停用。
- 本项目不包含图片和视频，首版仅使用少量数据库、云函数调用和日志。

## 待用户完成

1. 在微信开发者工具中导入项目根目录。
2. 打开云开发控制台，确认页面显示 `0 元` 后创建一个环境。
3. 记录环境名称和完整 EnvId；不要发送 AppSecret 或其他密钥。
4. 在目标环境手动创建集合：`babies`、`familyMembers`、`feedRecords`、`growthRecords`、`reminders`、`familyInvites`。
5. 将上述集合的客户端权限设为禁止直接读写；业务只通过 `babyApi` 云函数访问。
6. 部署 `cloudfunctions/babyApi`，安装云端依赖。
7. 把完整 EnvId 填入 `miniprogram/config/env.js` 的 `CLOUD_ENV_ID`。
8. 编译后执行首页只读加载，确认没有 `INVALID_ENV`，再测试新增记录。

集合不会由运行时代码自动创建。完整 EnvId 未同时通过控制台、客户端配置和只读调用验证前，项目状态保持“EnvId 待验证”。

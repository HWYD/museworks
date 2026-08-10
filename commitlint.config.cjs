const types = [
  { value: 'feat', name: '✨ feat: 新功能', emoji: '✨' },
  { value: 'fix', name: '🐛 fix: 修复缺陷', emoji: '🐛' },
  { value: 'docs', name: '📝 docs: 文档变更', emoji: '📝' },
  { value: 'style', name: '💄 style: 格式或样式调整', emoji: '💄' },
  { value: 'refactor', name: '♻️ refactor: 重构', emoji: '♻️' },
  { value: 'perf', name: '⚡ perf: 性能优化', emoji: '⚡' },
  { value: 'test', name: '✅ test: 测试变更', emoji: '✅' },
  { value: 'build', name: '🛠 build: 构建或依赖', emoji: '🛠' },
  { value: 'ci', name: '🎡 ci: 持续集成', emoji: '🎡' },
  { value: 'chore', name: '🔨 chore: 维护工作', emoji: '🔨' },
  { value: 'revert', name: '⏪ revert: 回退提交', emoji: '⏪' },
];

const scopePattern = /^(?=.{1,32}$)[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const ansiEscapePattern = /\u001B\[[0-?]*[ -/]*[@-~]/g;

function validateScope(scope) {
  return !scope || scopePattern.test(scope.replace(ansiEscapePattern, ''));
}

module.exports = {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'museworks-scope-format': (parsed) => [
          validateScope(parsed.scope),
          'scope must be 1–32 lowercase kebab-case characters',
        ],
      },
    },
  ],
  rules: {
    'type-enum': [2, 'always', types.map((type) => type.value)],
    'museworks-scope-format': [2, 'always'],
  },
  prompt: {
    useEmoji: false,
    allowCustomScopes: true,
    allowEmptyScopes: true,
    markBreakingChangeMode: true,
    allowBreakingChanges: [],
    skipQuestions: ['footerPrefix', 'customFooterPrefix', 'footer'],
    types,
    scopes: [
      { value: 'app', name: 'app: 应用入口或整体行为' },
      { value: 'ui', name: 'ui: 用户界面' },
      { value: 'api', name: 'api: 服务或接口' },
      { value: 'core', name: 'core: 核心领域逻辑' },
      { value: 'config', name: 'config: 配置' },
      { value: 'deps', name: 'deps: 依赖' },
      { value: 'tooling', name: 'tooling: 开发工具' },
      { value: 'infra', name: 'infra: 基础设施' },
      { value: 'security', name: 'security: 安全控制' },
    ],
    messages: {
      skip: '跳过',
      max: '最多 %d 个字符',
      min: '至少 %d 个字符',
      emptyWarning: '不能为空',
      upperLimitWarning: '超过最大长度',
      lowerLimitWarning: '低于最小长度',
      type: '选择本次提交类型：',
      scope: '选择影响范围（可跳过）：',
      customScope: '输入自定义 scope（小写 kebab-case）：',
      subject: '用简短祈使句描述改动（不加句号）：',
      body: '补充改动原因或实现背景（可跳过，使用 | 换行）：',
      markBreaking: '是否包含 BREAKING CHANGE？',
      breaking: '说明 BREAKING CHANGE 的迁移方式：',
      confirmCommit: '确认提交以上内容？',
    },
    formatMessageCB: ({ defaultMessage, scope, markBreaking, breaking }) => {
      if (!validateScope(scope)) {
        throw new Error('scope 必须是 1–32 个字符的小写 kebab-case。');
      }
      if (markBreaking && !breaking?.trim()) {
        throw new Error('BREAKING CHANGE 必须填写迁移说明。');
      }
      return defaultMessage;
    },
  },
};

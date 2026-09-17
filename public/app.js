const $ = id => document.getElementById(id);
let token = '', info;
function status(text, error = false) { $('status').textContent = text; $('status').className = error ? 'error' : 'success'; }
function clearConnection() { token = ''; $('token').value = ''; $('client-config').textContent = ''; $('connection-result').hidden = true; }
async function request(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  if (response.status === 204) return null;
  const data = await response.json(); if (!response.ok) throw new Error(data.message || data.error_description || '请求失败，请稍后重试。'); return data;
}
function renderTools() {
  const q = $('tool-search').value.toLowerCase(); $('tool-list').replaceChildren();
  for (const tool of info.tools.filter(t => `${t.name} ${t.description}`.toLowerCase().includes(q))) {
    const card = document.createElement('article'); card.className = 'tool';
    const badge = document.createElement('small'); badge.textContent = tool.write ? '写入 · 先预览再确认' : '研究与读取';
    const title = document.createElement('h3'); title.textContent = tool.name;
    const description = document.createElement('p'); description.textContent = tool.description;
    card.append(badge, title, description); $('tool-list').append(card);
  }
}
request('/api/info').then(data => { info = data; $('tool-count').textContent = info.tools.length; $('invite-field').hidden = !info.inviteRequired; $('capability-note').textContent = `${info.tools.length} 个工具 · ${info.writesEnabled ? '读写已启用，写入需预览确认' : '当前服务仅开放读取'} · ${info.semanticConfigured ? '已配置语义检索' : '语义检索待运营者配置'}`; $('token-note').textContent = `请保存此令牌，在客户端使用 Authorization: Bearer。${info.tokenTtlDays > 0 ? `令牌有效期为 ${info.tokenTtlDays} 天` : '令牌长期有效，直至你在本页撤销或删除连接'}。离开页面后不会再次显示。`; renderTools(); }).catch(() => { $('capability-note').textContent = '暂时无法读取服务状态，请刷新重试。'; });
$('tool-search').addEventListener('input', () => { if (info) renderTools(); });
$('connect-form').addEventListener('submit', async event => {
  event.preventDefault(); $('connect-button').disabled = true; status('正在向 Zotero 验证权限…');
  try {
    const body = JSON.stringify({ apiKey: $('api-key').value.trim(), signupSecret: $('invite').value || undefined });
    const data = await request('/api/connect', { method: 'POST', body });
    token = data.access_token; $('api-key').value = ''; $('invite').value = '';
    $('endpoint').value = data.endpoints.streamableHttp; $('token').value = token;
    $('client-config').textContent = JSON.stringify({ url: data.endpoints.streamableHttp, transport: 'streamable-http', headers: { Authorization: 'Bearer <在此填入你的服务令牌>' }, legacySseUrl: data.endpoints.sse }, null, 2);
    $('connection-result').hidden = false; status(`已连接 Zotero 用户 ${data.userId}。请保存服务令牌${info && info.tokenTtlDays === 0 ? '（长期有效）' : ''}。`);
  } catch (error) { status(error.message, true); } finally { $('connect-button').disabled = false; }
});
$('copy-token').addEventListener('click', async () => { try { await navigator.clipboard.writeText(token); status('服务令牌已复制。'); } catch { $('token').type = 'text'; $('token').select(); status('请手动复制选中的令牌。'); } });
$('revoke').addEventListener('click', async () => { try { await request('/api/revoke', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }); clearConnection(); status('此服务令牌已撤销。'); } catch (error) { status(error.message, true); } });
$('disconnect').addEventListener('click', async () => {
  if (!window.confirm('删除此连接保存的 Zotero key，并撤销使用同一 key 的所有服务令牌？Zotero 云端文献不会被删除。')) return;
  try { await request('/api/account', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); clearConnection(); status('连接与保存的密钥已删除。'); } catch (error) { status(error.message, true); }
});

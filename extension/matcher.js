export const fields = {
  fullName: ['姓名', '真实姓名', '中文姓名', 'full name', 'name'],
  firstName: ['first name', 'given name'], lastName: ['last name', 'family name', 'surname'],
  email: ['邮箱', '电子邮件', 'email', 'e-mail'], phone: ['手机', '手机号', '联系电话', 'phone', 'mobile', 'tel'],
  city: ['现居城市', '所在城市', '居住城市', 'city'], address: ['通讯地址', '联系地址', 'address'],
  school: ['毕业院校', '学校', '院校', 'university', 'school'], major: ['专业', 'major'],
  degree: ['学历', '学位', 'degree'], graduation: ['毕业时间', 'graduation'],
  linkedin: ['linkedin'], github: ['github'], website: ['个人网站', '作品集', 'portfolio', 'website'],
  introduction: ['自我介绍', '自我评价', 'personal statement', 'summary']
};
export function normalize(text) { return String(text ?? '').toLowerCase().replace(/[\s_*：:（）()\-]/g, ''); }
export function matchField(field, profile) {
  if (['password','hidden','file','checkbox','radio','submit','button'].includes(field.type)) return null;
  const labels = [field.label, field.name, field.autocomplete, field.placeholder].map(normalize).filter(Boolean);
  let best = null;
  for (const [key, aliases] of Object.entries(fields)) {
    if (!profile[key]) continue;
    const score = Math.max(0, ...aliases.flatMap(a => labels.map(l => l === normalize(a) ? 1 : !['name','tel'].includes(a) && normalize(a).length >= 3 && l.includes(normalize(a)) ? .82 : 0)));
    if (score && (!best || score > best.confidence)) best = {fieldId: field.id, key, value: profile[key], confidence: score};
  }
  return best;
}
export function makePlan(snapshot, profile) {
  return snapshot.fields.filter(f => !f.value && !f.disabled && !f.readOnly).map(f => matchField(f, profile)).filter(Boolean);
}

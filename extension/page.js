// Executed in Chrome's isolated world. Never executes instructions from page text.
export async function pageOperation(operation, args = {}) {
  const stateKey = '__applypilot_v1';
  const state = globalThis[stateKey] ||= {elements: new Map(), revision: ''};
  const visible = el => !!(el.getClientRects().length) && getComputedStyle(el).visibility !== 'hidden';
  const label = el => [...(el.labels || [])].map(l => l.textContent.trim()).join(' ') || el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ').trim() || el.placeholder || el.name || '';
  if (operation === 'inspect') {
    state.elements.clear(); state.revision = crypto.randomUUID();
    const fields = [...document.querySelectorAll('input,textarea,select')].filter(visible).filter(el => !['password','hidden','submit','button','reset'].includes(el.type)).map((el, i) => {
      const id = `${state.revision}:${i}`; state.elements.set(id, el);
      return {id, label: label(el), name: el.name, type: el.type, autocomplete: el.autocomplete, placeholder: el.placeholder || '', value: el.type === 'file' ? [...el.files].map(f => f.name).join(', ') : el.value, checked: !!el.checked, required: el.required, disabled: el.disabled, readOnly: !!el.readOnly, options: el.tagName === 'SELECT' ? [...el.options].map(o => ({label:o.text, value:o.value, disabled:o.disabled})) : undefined};
    });
    return {url: location.href, title: document.title, revision: state.revision, fields};
  }
  if (args.url !== location.href || args.revision !== state.revision) throw Error('页面已变化，请重新识别表单。');
  const get = id => { const el = state.elements.get(id); if (!el?.isConnected || !visible(el) || el.disabled || el.readOnly) throw Error('字段已变化或不可编辑，请重新识别。'); return el; };
  const notify = el => { el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); };
  if (operation === 'fill') {
    return args.entries.map(entry => {
      try {
        const el = get(entry.fieldId);
        if (['file','password','hidden','submit','button','reset','checkbox','radio'].includes(el.type)) throw Error('此字段需要手动处理');
        if (el.value && !entry.overwrite) throw Error('已有内容，已跳过');
        const value = String(entry.value);
        if (el.tagName === 'SELECT') {
          const option = [...el.options].find(o => !o.disabled && (o.value === value || o.text.trim() === value));
          if (!option) throw Error('没有匹配的选项');
          el.value = option.value;
        } else {
          const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
        }
        notify(el);
        if (!el.checkValidity()) return {fieldId:entry.fieldId, ok:false, error:el.validationMessage, applied:true};
        return {fieldId:entry.fieldId, ok:true};
      } catch (e) { return {fieldId:entry.fieldId, ok:false, error:e.message}; }
    });
  }
  if (operation === 'attach') {
    const el = get(args.fieldId);
    if (el.type !== 'file') throw Error('不是上传字段');
    const bytes = Uint8Array.from(atob(args.file.data), c => c.charCodeAt(0));
    const file = new File([bytes], args.file.name, {type:args.file.type});
    const accepted = (el.accept || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
    if (accepted.length && !accepted.some(a => a.startsWith('.') ? file.name.toLowerCase().endsWith(a) : a.endsWith('/*') ? file.type.startsWith(a.slice(0,-1)) : file.type === a)) throw Error('文件格式不符合页面要求');
    const transfer = new DataTransfer(); transfer.items.add(file); el.files = transfer.files; notify(el);
    return {ok: true, name:file.name};
  }
  throw Error('不支持的操作');
}

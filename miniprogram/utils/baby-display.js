function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) return null;
  return date;
}

function addMonthsClamped(date, months) {
  const targetMonth = date.getMonth() + months;
  const year = date.getFullYear() + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(date.getDate(), lastDay));
}

function calendarDayNumber(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
}

function formatAge(birthday, today = new Date()) {
  const birthDate = parseDate(birthday);
  if (!birthDate) return '月龄待完善';
  const currentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (birthDate > currentDate) return '生日待确认';
  let months = (currentDate.getFullYear() - birthDate.getFullYear()) * 12 + currentDate.getMonth() - birthDate.getMonth();
  let monthAnchor = addMonthsClamped(birthDate, months);
  if (monthAnchor > currentDate) {
    months -= 1;
    monthAnchor = addMonthsClamped(birthDate, months);
  }
  const days = calendarDayNumber(currentDate) - calendarDayNumber(monthAnchor);
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (!years && !remainingMonths && !days) return '出生当天';
  if (!years && remainingMonths && !days) return `${remainingMonths}月龄`;
  const parts = [];
  if (years) parts.push(`${years}岁`);
  if (remainingMonths) parts.push(`${remainingMonths}月`);
  if (days) parts.push(`${days}天`);
  return parts.join('');
}

function decorateBaby(baby = {}, today = new Date()) {
  const genderMap = {
    boy: { genderLabel: '皮夹克', heroClass: 'hero-boy' },
    girl: { genderLabel: '小棉袄', heroClass: 'hero-girl' },
    unknown: { genderLabel: '小宝贝', heroClass: 'hero-neutral' }
  };
  const gender = genderMap[baby.gender] ? baby.gender : 'unknown';
  return {
    ...baby,
    name: baby.name || '宝宝',
    gender,
    ageText: formatAge(baby.birthday, today),
    ...genderMap[gender]
  };
}

module.exports = { formatAge, decorateBaby };

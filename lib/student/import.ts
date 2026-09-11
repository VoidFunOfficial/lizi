import { read, utils } from 'xlsx';
import { parseTimetableRows } from './timetable.ts';

export const MAX_TIMETABLE_BYTES = 5 * 1024 * 1024;
export function importTimetable(buffer: ArrayBuffer) {
  if (!buffer.byteLength || buffer.byteLength > MAX_TIMETABLE_BYTES)
    throw new Error('请选择 5 MB 以内的 Excel 课表。');
  const workbook = read(buffer, {
    type: 'array',
    cellFormula: false,
    cellHTML: false,
    cellStyles: false,
    sheetRows: 301,
  });
  if (workbook.SheetNames.length > 20)
    throw new Error('工作表过多，请只导出学生个人课表。');
  return parseTimetableRows(
    workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name];
      const range = utils.decode_range(
        sheet['!fullref'] ?? sheet['!ref'] ?? 'A1',
      );
      if (range.e.r > 299 || range.e.c > 49)
        throw new Error('表格范围过大，请上传教务系统的个人课表。');
      return {
        name,
        rows: utils.sheet_to_json<unknown[]>(sheet, {
          header: 1,
          defval: '',
          raw: false,
        }),
      };
    }),
  );
}

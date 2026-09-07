import { sanitizeFormula } from './sheetImport';

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: ${message}. Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

export function testSanitizeFormula() {
  // Test formula trigger characters
  assertEqual(sanitizeFormula('=SUM(1,2)'), "'=SUM(1,2)", 'Prefixes = with single quote');
  assertEqual(sanitizeFormula('+10'), "'+10", 'Prefixes + with single quote');
  assertEqual(sanitizeFormula('-10'), "'-10", 'Prefixes - with single quote');
  assertEqual(sanitizeFormula('@cmd'), "'@cmd", 'Prefixes @ with single quote');
  assertEqual(sanitizeFormula('\tcell'), "'\tcell", 'Prefixes tab with single quote');
  assertEqual(sanitizeFormula('\rcell'), "'\rcell", 'Prefixes carriage return with single quote');

  // Test leading whitespace before formula trigger
  assertEqual(sanitizeFormula('  =1+1'), "'  =1+1", 'Prefixes leading spaces followed by formula trigger');
  assertEqual(sanitizeFormula('  -10'), "'  -10", 'Prefixes leading spaces followed by minus');

  // Test safe strings
  assertEqual(sanitizeFormula('Physics'), 'Physics', 'Leaves normal text untouched');
  assertEqual(sanitizeFormula('Score: 10'), 'Score: 10', 'Leaves normal text untouched');
  assertEqual(sanitizeFormula(100), 100, 'Leaves numbers untouched');
  assertEqual(sanitizeFormula(null), null, 'Leaves null untouched');
  assertEqual(sanitizeFormula(undefined), undefined, 'Leaves undefined untouched');

  console.log('All sanitizeFormula tests passed successfully!');
}

testSanitizeFormula();

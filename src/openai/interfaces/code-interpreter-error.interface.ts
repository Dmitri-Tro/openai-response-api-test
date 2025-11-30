/**
 * Parsed Python error structures for code interpreter
 * Phase 7.2: Error Handling & Security
 */

/**
 * Parsed Python error with extracted details
 */
export interface ParsedPythonError {
  /**
   * Error type (e.g., SyntaxError, NameError, ZeroDivisionError)
   */
  error_type: string;

  /**
   * Error message
   */
  message: string;

  /**
   * Line number where error occurred (if available)
   */
  line?: number;

  /**
   * Full Python traceback
   */
  traceback?: string;

  /**
   * Categorized error type for mapping to error codes
   */
  category: 'syntax' | 'runtime' | 'timeout' | 'resource_limit' | 'unknown';
}

/**
 * Code context around an error line
 */
export interface ErrorContext {
  /**
   * Line number of the error
   */
  line_number: number;

  /**
   * Code snippet around the error (e.g., 3 lines before and after)
   */
  code_snippet: string;

  /**
   * The specific line with the error
   */
  error_line: string;

  /**
   * Character position in the error line (if available)
   */
  column?: number;
}

/**
 * Common Python error types
 */
export const PYTHON_ERROR_TYPES = {
  // Syntax Errors
  SYNTAX_ERROR: 'SyntaxError',
  INDENTATION_ERROR: 'IndentationError',
  TAB_ERROR: 'TabError',

  // Runtime Errors - Names and Values
  NAME_ERROR: 'NameError',
  VALUE_ERROR: 'ValueError',
  TYPE_ERROR: 'TypeError',
  ATTRIBUTE_ERROR: 'AttributeError',
  KEY_ERROR: 'KeyError',
  INDEX_ERROR: 'IndexError',

  // Runtime Errors - Math and Operations
  ZERO_DIVISION_ERROR: 'ZeroDivisionError',
  OVERFLOW_ERROR: 'OverflowError',
  ARITHMETIC_ERROR: 'ArithmeticError',

  // Runtime Errors - I/O and OS
  FILE_NOT_FOUND_ERROR: 'FileNotFoundError',
  PERMISSION_ERROR: 'PermissionError',
  IO_ERROR: 'IOError',
  OS_ERROR: 'OSError',

  // Runtime Errors - Imports
  IMPORT_ERROR: 'ImportError',
  MODULE_NOT_FOUND_ERROR: 'ModuleNotFoundError',

  // Resource Errors
  MEMORY_ERROR: 'MemoryError',
  RECURSION_ERROR: 'RecursionError',

  // Timeout (custom)
  TIMEOUT_ERROR: 'TimeoutError',
} as const;

/**
 * Error category classification rules
 */
export const ERROR_CATEGORY_MAP: Record<
  string,
  'syntax' | 'runtime' | 'timeout' | 'resource_limit'
> = {
  [PYTHON_ERROR_TYPES.SYNTAX_ERROR]: 'syntax',
  [PYTHON_ERROR_TYPES.INDENTATION_ERROR]: 'syntax',
  [PYTHON_ERROR_TYPES.TAB_ERROR]: 'syntax',

  [PYTHON_ERROR_TYPES.NAME_ERROR]: 'runtime',
  [PYTHON_ERROR_TYPES.VALUE_ERROR]: 'runtime',
  [PYTHON_ERROR_TYPES.TYPE_ERROR]: 'runtime',
  [PYTHON_ERROR_TYPES.ATTRIBUTE_ERROR]: 'runtime',
  [PYTHON_ERROR_TYPES.KEY_ERROR]: 'runtime',
  [PYTHON_ERROR_TYPES.INDEX_ERROR]: 'runtime',
  [PYTHON_ERROR_TYPES.ZERO_DIVISION_ERROR]: 'runtime',
  [PYTHON_ERROR_TYPES.OVERFLOW_ERROR]: 'runtime',
  [PYTHON_ERROR_TYPES.ARITHMETIC_ERROR]: 'runtime',
  [PYTHON_ERROR_TYPES.FILE_NOT_FOUND_ERROR]: 'runtime',
  [PYTHON_ERROR_TYPES.PERMISSION_ERROR]: 'runtime',
  [PYTHON_ERROR_TYPES.IO_ERROR]: 'runtime',
  [PYTHON_ERROR_TYPES.OS_ERROR]: 'runtime',
  [PYTHON_ERROR_TYPES.IMPORT_ERROR]: 'runtime',
  [PYTHON_ERROR_TYPES.MODULE_NOT_FOUND_ERROR]: 'runtime',

  [PYTHON_ERROR_TYPES.MEMORY_ERROR]: 'resource_limit',
  [PYTHON_ERROR_TYPES.RECURSION_ERROR]: 'resource_limit',

  [PYTHON_ERROR_TYPES.TIMEOUT_ERROR]: 'timeout',
};

/**
 * Actionable hints for common Python errors
 */
export const PYTHON_ERROR_HINTS: Record<string, string> = {
  [PYTHON_ERROR_TYPES.SYNTAX_ERROR]:
    'Check for missing colons, unmatched brackets/parentheses, or invalid Python syntax.',
  [PYTHON_ERROR_TYPES.INDENTATION_ERROR]:
    'Ensure consistent indentation (use either spaces or tabs, not both). Python requires proper indentation for code blocks.',
  [PYTHON_ERROR_TYPES.NAME_ERROR]:
    'The variable or function name is not defined. Check for typos or ensure the variable is defined before use.',
  [PYTHON_ERROR_TYPES.VALUE_ERROR]:
    'The function received a value of correct type but inappropriate value. Check input ranges and formats.',
  [PYTHON_ERROR_TYPES.TYPE_ERROR]:
    'Operation attempted on incompatible types. Verify data types match the required operation (e.g., cannot add string to integer).',
  [PYTHON_ERROR_TYPES.ATTRIBUTE_ERROR]:
    'The object does not have the specified attribute or method. Check object type and available methods.',
  [PYTHON_ERROR_TYPES.KEY_ERROR]:
    'Dictionary key does not exist. Use .get() method with default value or check key existence with "in" operator.',
  [PYTHON_ERROR_TYPES.INDEX_ERROR]:
    'List index out of range. Verify array/list length before accessing elements.',
  [PYTHON_ERROR_TYPES.ZERO_DIVISION_ERROR]:
    'Division by zero attempted. Add conditional check to prevent dividing by zero.',
  [PYTHON_ERROR_TYPES.IMPORT_ERROR]:
    'Module could not be imported. The module may not be available in the code interpreter environment.',
  [PYTHON_ERROR_TYPES.MODULE_NOT_FOUND_ERROR]:
    'The specified module is not installed or available. Code interpreter includes pandas, numpy, matplotlib, but not all packages.',
  [PYTHON_ERROR_TYPES.MEMORY_ERROR]:
    'Insufficient memory for operation. Reduce data size, use generators, or process in smaller chunks.',
  [PYTHON_ERROR_TYPES.RECURSION_ERROR]:
    'Maximum recursion depth exceeded. Add base case to recursive function or use iterative approach.',
  [PYTHON_ERROR_TYPES.FILE_NOT_FOUND_ERROR]:
    'File not found in container. Ensure file is uploaded via file_ids in container configuration.',
  [PYTHON_ERROR_TYPES.TIMEOUT_ERROR]:
    'Code execution exceeded time limit (30-60 seconds). Optimize algorithms or reduce data size.',
};

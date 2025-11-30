import { Injectable } from '@nestjs/common';

/**
 * Security issue detected in code
 */
export interface SecurityIssue {
  /**
   * Type of security issue
   */
  type:
    | 'file_system_access'
    | 'network_access'
    | 'subprocess_execution'
    | 'eval_usage'
    | 'import_suspicious'
    | 'sensitive_data';

  /**
   * Severity level
   */
  severity: 'low' | 'medium' | 'high' | 'critical';

  /**
   * Description of the issue
   */
  description: string;

  /**
   * Line number where issue was detected (if applicable)
   */
  line?: number;

  /**
   * Suggested mitigation
   */
  mitigation: string;
}

/**
 * Result of security scan
 */
export interface SecurityScanResult {
  /**
   * Whether the code is considered safe
   */
  safe: boolean;

  /**
   * List of detected security issues
   */
  issues: SecurityIssue[];

  /**
   * Overall risk level
   */
  risk_level: 'none' | 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Code security service for static analysis
 * **Optional** - Used for enhanced security scanning before code execution
 * Phase 7.2: Error Handling & Security
 *
 * Note: This service performs basic pattern matching and is not a complete security solution.
 * Code interpreter runs in a sandboxed environment with restricted permissions.
 */
@Injectable()
export class CodeSecurityService {
  /**
   * Suspicious patterns that may indicate security issues
   * These are basic heuristics and not exhaustive
   */
  private readonly suspiciousPatterns: Array<{
    pattern: RegExp;
    type: SecurityIssue['type'];
    severity: SecurityIssue['severity'];
    description: string;
    mitigation: string;
  }> = [
    // File System Access
    {
      pattern: /\b(open|os\.path|pathlib|shutil)\s*\(/gi,
      type: 'file_system_access',
      severity: 'medium',
      description: 'File system access detected',
      mitigation:
        'Code interpreter has restricted file system access. Use uploaded files via file_ids instead.',
    },
    {
      pattern: /\bos\.(remove|unlink|rmdir|mkdir|chmod|chown)\s*\(/gi,
      type: 'file_system_access',
      severity: 'high',
      description: 'File system modification attempt detected',
      mitigation:
        'File system modifications are restricted in sandbox. Operations will likely fail.',
    },

    // Network Access
    {
      pattern:
        /\b(urllib|requests|http|socket|ftplib|smtplib|telnetlib)\s*\./gi,
      type: 'network_access',
      severity: 'high',
      description: 'Network access attempt detected',
      mitigation:
        'Code interpreter does not have internet access. Network requests will fail. Use built-in data processing instead.',
    },
    {
      pattern: /\bimport\s+(urllib|requests|http|socket|ftplib)/gi,
      type: 'network_access',
      severity: 'high',
      description: 'Network library import detected',
      mitigation:
        'Network libraries are restricted in sandbox. Import will succeed but usage will fail.',
    },

    // Subprocess Execution
    {
      pattern: /\b(subprocess|os\.system|os\.popen|os\.spawn)\s*\(/gi,
      type: 'subprocess_execution',
      severity: 'critical',
      description: 'Subprocess execution attempt detected',
      mitigation:
        'Subprocess execution is blocked in sandbox. Use Python built-ins and libraries instead of shell commands.',
    },
    {
      pattern: /\b__import__\s*\(/gi,
      type: 'subprocess_execution',
      severity: 'high',
      description: 'Dynamic import via __import__ detected',
      mitigation:
        'Dynamic imports may be restricted. Use standard import statements for clarity.',
    },

    // Eval/Exec Usage
    {
      pattern: /\b(eval|exec|compile)\s*\(/gi,
      type: 'eval_usage',
      severity: 'medium',
      description: 'Dynamic code execution (eval/exec) detected',
      mitigation:
        'Avoid eval/exec for security and performance. Use explicit code structures instead.',
    },

    // Suspicious Imports
    {
      pattern: /\bimport\s+(pickle|marshal|shelve|dbm)/gi,
      type: 'import_suspicious',
      severity: 'medium',
      description: 'Potentially unsafe serialization library imported',
      mitigation:
        'Pickle and similar libraries can execute arbitrary code when deserializing. Use json for data exchange.',
    },
    {
      pattern: /\bimport\s+(ctypes|cffi|sysconfig)/gi,
      type: 'import_suspicious',
      severity: 'high',
      description: 'Low-level system access library imported',
      mitigation:
        'Low-level system libraries are restricted in sandbox. Operations will likely fail.',
    },

    // Sensitive Data Patterns
    {
      pattern:
        /\b(password|secret|api[_-]key|private[_-]key|token|credential)\s*=/gi,
      type: 'sensitive_data',
      severity: 'low',
      description: 'Potential sensitive data assignment detected',
      mitigation:
        'Avoid hardcoding credentials. Use environment variables or secure configuration.',
    },
  ];

  /**
   * Scan code for potential security issues
   *
   * Performs static analysis to detect potentially unsafe operations.
   * This is a basic heuristic check and not a complete security solution.
   *
   * @param code - Python code to scan
   * @returns Security scan result with detected issues
   *
   * @example
   * ```typescript
   * const result = this.codeSecurityService.scanForSecurityIssues(pythonCode);
   * if (!result.safe && result.risk_level === 'critical') {
   *   throw new Error('Code contains critical security issues');
   * }
   * ```
   */
  scanForSecurityIssues(code: string): SecurityScanResult {
    const issues: SecurityIssue[] = [];
    const lines = code.split('\n');

    // Scan each line for suspicious patterns
    lines.forEach((line, index) => {
      for (const pattern of this.suspiciousPatterns) {
        if (pattern.pattern.test(line)) {
          issues.push({
            type: pattern.type,
            severity: pattern.severity,
            description: pattern.description,
            line: index + 1, // 1-indexed line numbers
            mitigation: pattern.mitigation,
          });
        }
      }
    });

    // Determine overall risk level
    const risk_level = this.calculateRiskLevel(issues);

    return {
      safe: risk_level === 'none' || risk_level === 'low',
      issues,
      risk_level,
    };
  }

  /**
   * Calculate overall risk level based on detected issues
   *
   * @param issues - Array of detected security issues
   * @returns Overall risk level
   * @private
   */
  private calculateRiskLevel(
    issues: SecurityIssue[],
  ): SecurityScanResult['risk_level'] {
    if (issues.length === 0) {
      return 'none';
    }

    const severityCounts = {
      critical: issues.filter((i) => i.severity === 'critical').length,
      high: issues.filter((i) => i.severity === 'high').length,
      medium: issues.filter((i) => i.severity === 'medium').length,
      low: issues.filter((i) => i.severity === 'low').length,
    };

    if (severityCounts.critical > 0) return 'critical';
    if (severityCounts.high >= 2) return 'critical';
    if (severityCounts.high > 0) return 'high';
    if (severityCounts.medium >= 3) return 'high';
    if (severityCounts.medium > 0) return 'medium';
    return 'low';
  }
}

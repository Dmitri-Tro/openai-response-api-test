/**
 * Code Interpreter Tool Configuration
 *
 * Enables Python code execution for data analysis, calculations, file processing,
 * and visualization generation in a secure sandboxed environment.
 *
 * Features:
 * - Execute Python 3.x code
 * - Process uploaded files (CSV, JSON, Excel, images, etc.)
 * - Generate plots and visualizations
 * - Perform complex calculations and data analysis
 * - Create output files (data exports, charts, reports)
 *
 * Pricing: $0.03 per container + standard token costs
 * Session: 1 hour duration, 20 minute idle timeout, automatic container reuse
 *
 * @see https://platform.openai.com/docs/api-reference/responses/create#responses-create-tools
 * @see https://platform.openai.com/docs/guides/code-interpreter
 */
export interface CodeInterpreterToolConfig {
  /**
   * Tool type identifier
   */
  type: 'code_interpreter';

  /**
   * Container configuration for code execution environment
   *
   * Can be:
   * - Omitted: OpenAI automatically manages container lifecycle
   * - String: Container ID to reuse existing container (e.g., "container_abc123")
   * - Object: Auto-configuration with optional file_ids
   *
   * @example { type: 'auto', file_ids: ['file-abc123...'] }
   * @example "container_abc123xyz789"
   */
  container?: string | CodeInterpreterContainer;
}

/**
 * Code Interpreter Container Configuration
 *
 * Controls the execution environment for Python code.
 * Containers are automatically created and reused to optimize performance and cost.
 *
 * Can be either:
 * - A container ID string (to reuse existing container)
 * - An 'auto' configuration object (to auto-create/reuse container)
 */
export interface CodeInterpreterContainer {
  /**
   * Container type - must be 'auto'
   *
   * 'auto': Automatically creates new container or reuses active one from previous call
   *
   * Note: This is the only supported value in the current OpenAI API
   */
  type: 'auto';

  /**
   * Array of file IDs to make available in the code execution environment
   *
   * - File IDs must be previously uploaded via Files API
   * - Format: "file-" followed by 24 alphanumeric characters
   * - Files are accessible to Python code during execution
   * - Supports 30+ formats: CSV, JSON, PDF, images, Excel, etc.
   * - Maximum file size: Varies by plan (typically 512MB per file)
   *
   * @example ['file-abc123xyz789012345678901', 'file-def456uvw345678901234567']
   */
  file_ids?: string[];
}

/**
 * Code Interpreter Tool Configuration (Simplified for DTO usage)
 *
 * This is a simplified interface that matches OpenAI SDK expectations.
 * For strict SDK compatibility, use the SDK's native types directly.
 */
export interface CodeInterpreterToolSimple {
  type: 'code_interpreter';
  container?: string | CodeInterpreterContainer;
}

/**
 * Prompt Template Variable Types
 *
 * These interfaces define the structure of variable values that can be used
 * in prompt templates via the `prompt.variables` parameter.
 *
 * @see {@link https://platform.openai.com/docs/api-reference/responses#prompt-templates}
 */

/**
 * Text input variable for prompt templates
 *
 * @example
 * ```typescript
 * {
 *   type: 'input_text',
 *   text: 'This is the content to substitute'
 * }
 * ```
 */
export interface ResponseInputText {
  /** Discriminator field */
  type: 'input_text';
  /** The text content to substitute in the prompt template */
  text: string;
}

/**
 * Image input variable for prompt templates
 *
 * Allows embedding images as variables in prompt templates.
 * Must provide either `image_url` (URL to image) or `image_data` (base64-encoded).
 *
 * @example
 * ```typescript
 * {
 *   type: 'input_image',
 *   detail: 'high',
 *   image_url: 'https://example.com/image.jpg'
 * }
 * ```
 *
 * @example
 * ```typescript
 * {
 *   type: 'input_image',
 *   detail: 'auto',
 *   image_data: 'data:image/png;base64,iVBORw0KGgo...'
 * }
 * ```
 */
export interface ResponseInputImage {
  /** Discriminator field */
  type: 'input_image';
  /** Image detail level for vision analysis */
  detail: 'low' | 'high' | 'auto';
  /** URL to the image (optional if image_data is provided) */
  image_url?: string;
  /** Base64-encoded image data (optional if image_url is provided) */
  image_data?: string;
}

/**
 * File input variable for prompt templates
 *
 * Allows embedding file references as variables in prompt templates.
 * Must provide either `file_id` (OpenAI file ID) or `file_data` (base64-encoded).
 *
 * @example
 * ```typescript
 * {
 *   type: 'input_file',
 *   file_id: 'file-abc123xyz789012345678901',
 *   purpose: 'vision',
 *   filename: 'document.pdf'
 * }
 * ```
 */
export interface ResponseInputFile {
  /** Discriminator field */
  type: 'input_file';
  /** OpenAI file ID (format: "file-*", optional if file_data is provided) */
  file_id?: string;
  /** Base64-encoded file data (optional if file_id is provided) */
  file_data?: string;
  /** Purpose of the file (e.g., 'vision', 'assistants') */
  purpose?: string;
  /** Original filename */
  filename?: string;
}

/**
 * Union type for all prompt template variable values
 *
 * Variables in prompt templates can be:
 * - Simple strings
 * - Text input objects
 * - Image input objects
 * - File input objects
 *
 * @example
 * ```typescript
 * const variables: Record<string, PromptVariableValue> = {
 *   user_name: 'Alice',
 *   profile_image: {
 *     type: 'input_image',
 *     detail: 'high',
 *     image_url: 'https://example.com/alice.jpg'
 *   },
 *   context_document: {
 *     type: 'input_file',
 *     file_id: 'file-abc123'
 *   }
 * };
 * ```
 */
export type PromptVariableValue =
  | string
  | ResponseInputText
  | ResponseInputImage
  | ResponseInputFile;

/**
 * Prompt template configuration
 *
 * Reusable prompt templates combine messages, tool definitions, and model config
 * with support for template variables for dynamic content substitution.
 *
 * @example
 * ```typescript
 * {
 *   id: 'pmpt_customer_support_v1',
 *   version: '2',
 *   variables: {
 *     customer_name: 'John Doe',
 *     issue_type: 'billing'
 *   }
 * }
 * ```
 */
export interface PromptTemplate {
  /**
   * The unique identifier of the prompt template to use
   * Format: Must start with "pmpt_"
   */
  id: string;

  /**
   * Optional map of values to substitute in for variables in your prompt
   * Keys are variable names, values can be strings or input objects
   */
  variables?: Record<string, PromptVariableValue> | null;

  /**
   * Optional version of the prompt template
   * If omitted, the latest version is used
   */
  version?: string | null;
}

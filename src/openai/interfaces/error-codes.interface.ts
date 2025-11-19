/**
 * Error code type definitions for OpenAI Responses API
 * Enhanced Error Handling
 */

/**
 * OpenAI API error types (from SDK)
 */
export type OpenAIErrorType =
  | 'invalid_request_error'
  | 'authentication_error'
  | 'rate_limit_error'
  | 'api_error'
  | 'server_error'
  | 'service_unavailable';

/**
 * Image-specific error codes
 */
export type ImageErrorCode =
  // Vector Store Errors
  | 'vector_store_timeout'
  // Generic Image Errors
  | 'invalid_image'
  | 'invalid_image_format'
  | 'invalid_base64_image'
  | 'invalid_image_url'
  | 'image_parse_error'
  | 'invalid_image_mode'
  | 'unsupported_image_media_type'
  // Image Size Errors
  | 'image_too_large'
  | 'image_too_small'
  | 'image_file_too_large'
  | 'empty_image_file'
  // Image Content Errors
  | 'image_content_policy_violation'
  // Image Download Errors
  | 'failed_to_download_image'
  | 'image_file_not_found';

/**
 * Network error codes (Node.js)
 */
export type NetworkErrorCode =
  | 'ECONNREFUSED'
  | 'ETIMEDOUT'
  | 'ECONNRESET'
  | 'ENOTFOUND'
  | 'EHOSTUNREACH';

/**
 * OpenAI API-specific error codes (not image-related)
 */
export type OpenAIAPIErrorCode =
  | 'rate_limit_error'
  | 'authentication_error'
  | 'invalid_request_error'
  | 'server_error'
  | 'api_error'
  | 'permission_denied_error'
  | 'not_found_error'
  | 'timeout_error';

/**
 * All supported error codes
 */
export type ErrorCode = ImageErrorCode | NetworkErrorCode | OpenAIAPIErrorCode;

/**
 * Rate limit information from OpenAI response headers
 */
export interface RateLimitInfo {
  limit_requests?: string | number;
  remaining_requests?: string | number;
  reset_requests?: string | number;
  limit_tokens?: string | number;
  remaining_tokens?: string | number;
  reset_tokens?: string | number;
}

/**
 * Enhanced error response structure
 */
export interface EnhancedErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  message: string;
  request_id?: string;
  error_code?: ErrorCode;
  parameter?: string | null;
  hint?: string;
  rate_limit_info?: RateLimitInfo;
  retry_after_seconds?: number | string;
  openai_error?: {
    type: string;
    code?: string;
    param?: string | null;
    message: string;
    full_error?: unknown;
  };
  error?: unknown;
  details?: string;
  full_error?: {
    message: string;
    name?: string;
    stack?: string;
  };
}

/**
 * Mapping of image error codes to HTTP status codes and user-friendly messages
 */
export const IMAGE_ERROR_CODE_MAPPINGS: Record<
  ImageErrorCode,
  {
    status: number;
    message: string;
    hint: string;
  }
> = {
  // Vector Store Errors
  vector_store_timeout: {
    status: 504,
    message: 'File search operation timed out',
    hint: 'The vector store search took too long. Try reducing the search scope or simplifying your query.',
  },

  // Generic Image Errors
  invalid_image: {
    status: 400,
    message: 'Invalid image provided',
    hint: 'The image failed validation. Ensure it is a valid image file in a supported format (PNG, JPEG, WebP).',
  },
  invalid_image_format: {
    status: 400,
    message: 'Unsupported image format',
    hint: 'Only PNG, JPEG, or WebP formats are supported. Convert your image to one of these formats.',
  },
  invalid_base64_image: {
    status: 400,
    message: 'Malformed base64-encoded image',
    hint: 'The base64 image data is invalid. Verify the encoding is correct and complete.',
  },
  invalid_image_url: {
    status: 400,
    message: 'Invalid image URL',
    hint: 'The image URL is malformed or inaccessible. Ensure it is a valid HTTP/HTTPS URL.',
  },
  image_parse_error: {
    status: 400,
    message: 'Unable to parse image file',
    hint: 'The image file is corrupted or in an unrecognized format. Try re-saving or converting the image.',
  },
  invalid_image_mode: {
    status: 400,
    message: 'Unsupported image mode',
    hint: 'The image color mode is not supported. Convert to RGB or RGBA mode.',
  },
  unsupported_image_media_type: {
    status: 400,
    message: 'Unsupported image MIME type',
    hint: 'The image MIME type is not supported. Use image/png, image/jpeg, or image/webp.',
  },

  // Image Size Errors
  image_too_large: {
    status: 400,
    message: 'Image exceeds maximum size limit',
    hint: 'Maximum image size is 20MB. Resize or compress your image before uploading.',
  },
  image_too_small: {
    status: 400,
    message: 'Image is below minimum size requirements',
    hint: 'The image dimensions are too small. Ensure minimum dimensions are met for your use case.',
  },
  image_file_too_large: {
    status: 400,
    message: 'Image file size exceeds limit',
    hint: 'The image file is too large. Compress the file or reduce its dimensions.',
  },
  empty_image_file: {
    status: 400,
    message: 'Empty image file provided',
    hint: 'The image file is empty (0 bytes). Provide a valid image file.',
  },

  // Image Content Errors
  image_content_policy_violation: {
    status: 400,
    message: 'Image violates content policy',
    hint: 'The image contains content that violates OpenAI usage policies. Review and modify the image.',
  },

  // Image Download Errors
  failed_to_download_image: {
    status: 502,
    message: 'Failed to download image from URL',
    hint: 'Unable to download the image. Verify the URL is accessible and not behind authentication or firewall.',
  },
  image_file_not_found: {
    status: 404,
    message: 'Image file not found at URL',
    hint: 'The image URL returned 404. Verify the URL is correct and the resource exists.',
  },
};

/**
 * Mapping of network error codes to HTTP status codes and messages
 */
export const NETWORK_ERROR_CODE_MAPPINGS: Record<
  NetworkErrorCode,
  {
    status: number;
    message: string;
    hint: string;
  }
> = {
  ECONNREFUSED: {
    status: 503,
    message: 'Cannot connect to OpenAI API',
    hint: 'Connection refused. Verify your network connection and that OpenAI services are accessible.',
  },
  ETIMEDOUT: {
    status: 504,
    message: 'Request to OpenAI API timed out',
    hint: 'The request exceeded the timeout limit. Try again or increase the timeout setting.',
  },
  ECONNRESET: {
    status: 504,
    message: 'Connection to OpenAI API was reset',
    hint: 'The connection was interrupted. This is usually temporary; retry with exponential backoff.',
  },
  ENOTFOUND: {
    status: 503,
    message: 'Cannot resolve OpenAI API hostname',
    hint: 'DNS resolution failed. Check your network connection and DNS settings.',
  },
  EHOSTUNREACH: {
    status: 503,
    message: 'OpenAI API host unreachable',
    hint: 'Cannot reach the OpenAI API. Check your network connection and firewall settings.',
  },
};

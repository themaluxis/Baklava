using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using MediaBrowser.Controller.Library;
using MediaBrowser.Model.Entities;
using MediaBrowser.Controller;

namespace Baklava.Api
{
    [ApiController]
    [Route("api/baklava/downloads")]
    [Produces("application/json")]
    public class DownloadsController : ControllerBase
    {
        private readonly ILogger<DownloadsController> _logger;
        private readonly ILibraryManager _libraryManager;
        private readonly IServerApplicationPaths _appPaths;
        
        // Track active downloads in memory (not persisted)
        private static readonly ConcurrentDictionary<string, UserDownload> _activeDownloads = new();

        public DownloadsController(
            ILogger<DownloadsController> logger,
            ILibraryManager libraryManager,
            IServerApplicationPaths appPaths)
        {
            _logger = logger;
            _libraryManager = libraryManager;
            _appPaths = appPaths;
        }

        /// <summary>
        /// Get downloads for a specific user
        /// </summary>
        [HttpGet]
        public ActionResult GetDownloads([FromQuery] string? userId = null)
        {
            _logger.LogInformation("[Downloads] GET downloads called with userId: {UserId}", userId ?? "null");
            
            var config = Plugin.Instance?.Configuration;
            if (config == null)
            {
                _logger.LogWarning("[Downloads] Plugin configuration is null");
                return Ok(new { active = new List<UserDownload>(), completed = new List<UserDownload>() });
            }

            // If no userId provided, try to get from query or return all (for backwards compatibility)
            var allDownloads = config.Downloads ?? new List<UserDownload>();
            _logger.LogInformation("[Downloads] Total downloads in config: {Count}", allDownloads.Count);
            
            // Filter by userId if provided
            if (!string.IsNullOrEmpty(userId))
            {
                allDownloads = allDownloads.Where(d => d.UserId == userId).ToList();
                _logger.LogInformation("[Downloads] Filtered downloads for user {UserId}: {Count}", userId, allDownloads.Count);
            }

            // Merge with active downloads
            var activeList = _activeDownloads.Values
                .Where(d => string.IsNullOrEmpty(userId) || d.UserId == userId)
                .ToList();

            var completed = allDownloads.Where(d => d.Status == "completed").ToList();
            
            _logger.LogInformation("[Downloads] Returning {Active} active, {Completed} completed", activeList.Count, completed.Count);

            return Ok(new
            {
                active = activeList,
                completed = completed
            });
        }

        /// <summary>
        /// Get download status by ID
        /// </summary>
        [HttpGet("{id}")]
        public ActionResult GetDownloadStatus(string id)
        {
            // Check active downloads first
            if (_activeDownloads.TryGetValue(id, out var activeDownload))
            {
                return Ok(activeDownload);
            }

            // Check persisted downloads
            var config = Plugin.Instance?.Configuration;
            if (config != null)
            {
                var download = config.Downloads?.FirstOrDefault(d => d.Id == id);
                if (download != null)
                {
                    return Ok(download);
                }
            }

            return NotFound(new { error = "Download not found" });
        }

        /// <summary>
        /// Start a new download
        /// </summary>
        [HttpPost]
        public async Task<ActionResult> StartDownload([FromBody] DownloadRequest request)
        {
            try
            {
                _logger.LogInformation("[Downloads] Starting download for item: {ItemId}, User: {UserId}", request.JellyfinId, request.UserId);

                if (string.IsNullOrEmpty(request.UserId))
                {
                    return BadRequest(new { error = "UserId is required" });
                }

                // Get the item from Jellyfin
                if (!Guid.TryParse(request.JellyfinId, out var itemGuid))
                {
                    return BadRequest(new { error = "Invalid Jellyfin ID" });
                }

                var item = _libraryManager.GetItemById(itemGuid);
                if (item == null)
                {
                    return NotFound(new { error = "Item not found in library" });
                }

                // Get the media source path
                var mediaSource = item.GetMediaSources(false).FirstOrDefault();
                if (mediaSource == null || string.IsNullOrEmpty(mediaSource.Path))
                {
                    return BadRequest(new { error = "No media source found for this item" });
                }

                // Use user-specific folder: {DATA}/downloads/{userId}
                string userDownloadsPath = Path.Combine(_appPaths.DataPath, "downloads", request.UserId);
                
                // Create user downloads folder if it doesn't exist
                if (!Directory.Exists(userDownloadsPath))
                {
                    Directory.CreateDirectory(userDownloadsPath);
                    _logger.LogInformation("[Downloads] Created user downloads directory: {Path}", userDownloadsPath);
                }

                // Create download record
                var downloadId = $"dl_{Guid.NewGuid():N}";
                var userDownload = new UserDownload
                {
                    Id = downloadId,
                    UserId = request.UserId,
                    Username = "", // TODO: Get username from user manager
                    JellyfinId = request.JellyfinId,
                    Title = item.Name,
                    Year = item.ProductionYear?.ToString() ?? "",
                    ItemType = item is MediaBrowser.Controller.Entities.Movies.Movie ? "movie" : "series",
                    Status = "active",
                    Progress = 0,
                    Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                    FilePath = "", // Will be set after download
                    TotalSize = mediaSource.Size ?? 0
                };

                // Store source path temporarily (not persisted)
                var downloadInfo = new DownloadInfo
                {
                    Id = downloadId,
                    JellyfinId = request.JellyfinId,
                    Title = item.Name,
                    Year = item.ProductionYear?.ToString() ?? "",
                    ItemType = userDownload.ItemType,
                    Status = "active",
                    Progress = 0,
                    StartedAt = DateTime.UtcNow,
                    SourcePath = mediaSource.Path,
                    LibraryPath = userDownloadsPath,
                    Size = mediaSource.Size ?? 0
                };

                _activeDownloads.TryAdd(downloadId, userDownload);

                // Start download in background
                _ = Task.Run(async () => await ProcessDownload(downloadInfo, userDownload));

                return Ok(new
                {
                    id = downloadId,
                    status = "started",
                    download = userDownload
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Downloads] Error starting download");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Cancel an active download
        /// </summary>
        [HttpDelete("{id}")]
        public ActionResult CancelDownload(string id)
        {
            if (_activeDownloads.TryRemove(id, out var download))
            {
                download.Status = "cancelled";
                _logger.LogInformation("[Downloads] Cancelled download: {Id}", id);
                
                // Save to config as cancelled
                SaveDownloadToConfig(download);
                
                return Ok(new { message = "Download cancelled" });
            }

            return NotFound(new { error = "Download not found or already completed" });
        }

        /// <summary>
        /// Stream a downloaded file
        /// </summary>
        [HttpGet("{id}/stream")]
        public ActionResult StreamDownload(string id)
        {
            try
            {
                var config = Plugin.Instance?.Configuration;
                if (config == null)
                {
                    return NotFound(new { error = "Configuration not available" });
                }

                var download = config.Downloads?.FirstOrDefault(d => d.Id == id);
                if (download == null)
                {
                    return NotFound(new { error = "Download not found" });
                }

                if (string.IsNullOrEmpty(download.FilePath) || !System.IO.File.Exists(download.FilePath))
                {
                    return NotFound(new { error = "File not found on disk" });
                }

                var fileInfo = new FileInfo(download.FilePath);
                var contentType = GetContentType(download.FilePath);
                
                _logger.LogInformation("[Downloads] Streaming file: {Path}", download.FilePath);

                return PhysicalFile(fileInfo.FullName, contentType, enableRangeProcessing: true);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Downloads] Error streaming download {Id}", id);
                return StatusCode(500, new { error = ex.Message });
            }
        }

        private string GetContentType(string filePath)
        {
            var extension = Path.GetExtension(filePath).ToLowerInvariant();
            return extension switch
            {
                ".mp4" => "video/mp4",
                ".mkv" => "video/x-matroska",
                ".avi" => "video/x-msvideo",
                ".mov" => "video/quicktime",
                ".wmv" => "video/x-ms-wmv",
                ".flv" => "video/x-flv",
                ".webm" => "video/webm",
                ".m4v" => "video/x-m4v",
                _ => "application/octet-stream"
            };
        }

        private async Task ProcessDownload(DownloadInfo downloadInfo, UserDownload userDownload)
        {
            try
            {
                _logger.LogInformation("[Downloads] Processing download: {Title}", downloadInfo.Title);

                var sourcePath = downloadInfo.SourcePath;
                
                _logger.LogInformation("[Downloads] Source path: {SourcePath}", sourcePath);
                
                // Check if source is a URL (streaming) or local file
                if (sourcePath.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
                    sourcePath.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                {
                    // Download from URL
                    _logger.LogInformation("[Downloads] Downloading from URL to: {Path}", Path.Combine(downloadInfo.LibraryPath, SanitizeFileName(downloadInfo.Title) + GetFileExtension(sourcePath)));
                    await DownloadFromUrl(downloadInfo, userDownload);
                }
                else if (System.IO.File.Exists(sourcePath))
                {
                    // Copy local file
                    _logger.LogInformation("[Downloads] Copying local file from: {SourcePath}", sourcePath);
                    await CopyLocalFile(downloadInfo, userDownload);
                }
                else
                {
                    throw new Exception($"Source not accessible: {sourcePath}");
                }

                // Mark as completed in userDownload
                userDownload.Status = "completed";
                userDownload.Progress = 100;
                userDownload.CompletedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                userDownload.FilePath = downloadInfo.DestinationPath;
                
                // Remove from active and save to config
                _activeDownloads.TryRemove(downloadInfo.Id, out _);
                SaveDownloadToConfig(userDownload);

                _logger.LogInformation("[Downloads] Completed download: {Title} for user {UserId}", userDownload.Title, userDownload.UserId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Downloads] Error processing download: {Title}", downloadInfo.Title);
                
                if (userDownload != null)
                {
                    userDownload.Status = "failed";
                    userDownload.Error = ex.Message;
                    
                    _activeDownloads.TryRemove(downloadInfo.Id, out _);
                    SaveDownloadToConfig(userDownload);
                }
            }
        }

        private async Task DownloadFromUrl(DownloadInfo downloadInfo, UserDownload userDownload)
        {
            using var httpClient = new HttpClient();
            httpClient.Timeout = TimeSpan.FromHours(4); // Long timeout for large files

            var fileName = $"{SanitizeFileName(downloadInfo.Title)}{GetFileExtension(downloadInfo.SourcePath)}";
            var destinationPath = Path.Combine(downloadInfo.LibraryPath, fileName);

            _logger.LogInformation("[Downloads] Starting HTTP download from URL");
            _logger.LogInformation("[Downloads] Destination: {Path}", destinationPath);

            try
            {
                using var response = await httpClient.GetAsync(downloadInfo.SourcePath, HttpCompletionOption.ResponseHeadersRead);
                response.EnsureSuccessStatusCode();

                var totalBytes = response.Content.Headers.ContentLength ?? 0;
                downloadInfo.Size = totalBytes;
                userDownload.TotalSize = totalBytes;
                
                _logger.LogInformation("[Downloads] File size: {Size} bytes ({MB} MB)", 
                    totalBytes, totalBytes / 1024.0 / 1024.0);

                // Start background task to monitor file size
                var progressMonitor = Task.Run(async () =>
                {
                    int lastReportedProgress = 0;
                    while (_activeDownloads.ContainsKey(downloadInfo.Id) && downloadInfo.Status == "active")
                    {
                        await Task.Delay(2000); // Check every 2 seconds
                        
                        if (System.IO.File.Exists(destinationPath))
                        {
                            var fileInfo = new FileInfo(destinationPath);
                            var currentSize = fileInfo.Length;
                            
                            if (totalBytes > 0)
                            {
                                downloadInfo.Progress = (int)((currentSize * 100) / totalBytes);
                                userDownload.Progress = downloadInfo.Progress; // Sync progress
                                
                                // Log every 10% change
                                if (downloadInfo.Progress >= lastReportedProgress + 10)
                                {
                                    lastReportedProgress = downloadInfo.Progress;
                                    _logger.LogInformation("[Downloads] Progress: {Progress}% ({CurrentMB}/{TotalMB} MB)", 
                                        downloadInfo.Progress, 
                                        currentSize / 1024.0 / 1024.0,
                                        totalBytes / 1024.0 / 1024.0);
                                }
                            }
                        }
                    }
                });

                await using var contentStream = await response.Content.ReadAsStreamAsync();
                await using var fileStream = new FileStream(destinationPath, FileMode.Create, FileAccess.Write, FileShare.Read, 1024 * 1024, true);

                var buffer = new byte[1024 * 1024]; // 1MB buffer
                int bytesRead;

                _logger.LogInformation("[Downloads] Starting download...");

                while ((bytesRead = await contentStream.ReadAsync(buffer, 0, buffer.Length)) > 0)
                {
                    await fileStream.WriteAsync(buffer, 0, bytesRead);

                    if (!_activeDownloads.ContainsKey(downloadInfo.Id))
                    {
                        fileStream.Close();
                        System.IO.File.Delete(destinationPath);
                        throw new Exception("Download cancelled by user");
                    }
                }

                // Ensure progress is 100% before finishing
                downloadInfo.Progress = 100;
                userDownload.Progress = 100;
                _logger.LogInformation("[Downloads] Download complete");
                downloadInfo.DestinationPath = destinationPath;
                
                // Stop progress monitor
                await Task.Delay(100); // Give monitor one last cycle
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Downloads] Error in DownloadFromUrl: {Message}", ex.Message);
                throw;
            }
        }

        private async Task CopyLocalFile(DownloadInfo downloadInfo, UserDownload userDownload)
        {
            var fileName = Path.GetFileName(downloadInfo.SourcePath);
            var destinationPath = Path.Combine(downloadInfo.LibraryPath, fileName);

            _logger.LogInformation("[Downloads] Copying local file to: {Path}", destinationPath);

            var sourceInfo = new FileInfo(downloadInfo.SourcePath);
            downloadInfo.Size = sourceInfo.Length;
            userDownload.TotalSize = sourceInfo.Length;
            
            _logger.LogInformation("[Downloads] File size: {Size} bytes ({MB} MB)", 
                downloadInfo.Size, downloadInfo.Size / 1024.0 / 1024.0);

            // Start background task to monitor file size
            var progressMonitor = Task.Run(async () =>
            {
                int lastReportedProgress = 0;
                while (_activeDownloads.ContainsKey(downloadInfo.Id) && downloadInfo.Status == "active")
                {
                    await Task.Delay(2000); // Check every 2 seconds
                    
                    if (System.IO.File.Exists(destinationPath))
                    {
                        var fileInfo = new FileInfo(destinationPath);
                        var currentSize = fileInfo.Length;
                        
                        downloadInfo.Progress = (int)((currentSize * 100) / downloadInfo.Size);
                        userDownload.Progress = downloadInfo.Progress; // Sync progress
                        
                        // Log every 10% change
                        if (downloadInfo.Progress >= lastReportedProgress + 10)
                        {
                            lastReportedProgress = downloadInfo.Progress;
                            _logger.LogInformation("[Downloads] Progress: {Progress}% ({CurrentMB}/{TotalMB} MB)", 
                                downloadInfo.Progress, 
                                currentSize / 1024.0 / 1024.0,
                                downloadInfo.Size / 1024.0 / 1024.0);
                        }
                    }
                }
            });

            const int bufferSize = 1024 * 1024; // 1MB buffer
            var buffer = new byte[bufferSize];

            await using var sourceStream = new FileStream(downloadInfo.SourcePath, FileMode.Open, FileAccess.Read, FileShare.Read, bufferSize, true);
            await using var destinationStream = new FileStream(destinationPath, FileMode.Create, FileAccess.Write, FileShare.Read, bufferSize, true);

            int bytesRead;
            while ((bytesRead = await sourceStream.ReadAsync(buffer, 0, buffer.Length)) > 0)
            {
                await destinationStream.WriteAsync(buffer, 0, bytesRead);

                // Check if download was cancelled
                if (!_activeDownloads.ContainsKey(downloadInfo.Id))
                {
                    destinationStream.Close();
                    System.IO.File.Delete(destinationPath);
                    throw new Exception("Download cancelled by user");
                }
            }

            // Ensure progress is 100%
            downloadInfo.Progress = 100;
            userDownload.Progress = 100;
            downloadInfo.DestinationPath = destinationPath;
            
            // Stop progress monitor
            await Task.Delay(100); // Give monitor one last cycle
        }

        private string SanitizeFileName(string fileName)
        {
            var invalid = Path.GetInvalidFileNameChars();
            return string.Join("_", fileName.Split(invalid, StringSplitOptions.RemoveEmptyEntries)).TrimEnd('.');
        }

        private string GetFileExtension(string path)
        {
            var ext = Path.GetExtension(path);
            return string.IsNullOrEmpty(ext) ? ".mkv" : ext;
        }

        private void SaveDownloadToConfig(UserDownload download)
        {
            try
            {
                var config = Plugin.Instance?.Configuration;
                if (config == null)
                {
                    _logger.LogError("[Downloads] Cannot save download - config is null");
                    return;
                }

                // Remove existing entry with same ID (update)
                config.Downloads.RemoveAll(d => d.Id == download.Id);
                
                // Add the download
                config.Downloads.Add(download);
                
                // Save configuration
                Plugin.Instance.SaveConfiguration();
                
                _logger.LogInformation("[Downloads] Saved download {Id} for user {UserId} to config", download.Id, download.UserId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Downloads] Error saving download to config");
            }
        }
    }

    public class DownloadRequest
    {
        [JsonPropertyName("jellyfinId")]
        public string JellyfinId { get; set; } = "";

        [JsonPropertyName("userId")]
        public string UserId { get; set; } = "";
    }

    public class DownloadInfo
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = "";

        [JsonPropertyName("jellyfinId")]
        public string JellyfinId { get; set; } = "";

        [JsonPropertyName("title")]
        public string Title { get; set; } = "";

        [JsonPropertyName("year")]
        public string Year { get; set; } = "";

        [JsonPropertyName("itemType")]
        public string ItemType { get; set; } = "";

        [JsonPropertyName("status")]
        public string Status { get; set; } = "active"; // active, completed, failed, cancelled

        [JsonPropertyName("progress")]
        public int Progress { get; set; } = 0;

        [JsonPropertyName("size")]
        public long Size { get; set; } = 0;

        [JsonPropertyName("sourcePath")]
        public string SourcePath { get; set; } = "";

        [JsonPropertyName("destinationPath")]
        public string DestinationPath { get; set; } = "";

        [JsonPropertyName("libraryPath")]
        public string LibraryPath { get; set; } = "";

        [JsonPropertyName("startedAt")]
        public DateTime StartedAt { get; set; }

        [JsonPropertyName("completedAt")]
        public DateTime? CompletedAt { get; set; }

        [JsonPropertyName("error")]
        public string? Error { get; set; }
    }
}

// UserDownload class moved to PluginConfiguration.cs
namespace Baklava
{
    public class UserDownload
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = "";

        [JsonPropertyName("userId")]
        public string UserId { get; set; } = "";

        [JsonPropertyName("username")]
        public string Username { get; set; } = "";

        [JsonPropertyName("jellyfinId")]
        public string JellyfinId { get; set; } = "";

        [JsonPropertyName("title")]
        public string Title { get; set; } = "";

        [JsonPropertyName("year")]
        public string Year { get; set; } = "";

        [JsonPropertyName("itemType")]
        public string ItemType { get; set; } = "";

        [JsonPropertyName("filePath")]
        public string FilePath { get; set; } = "";

        [JsonPropertyName("totalSize")]
        public long TotalSize { get; set; } = 0;

        [JsonPropertyName("status")]
        public string Status { get; set; } = "active"; // active, completed, failed, cancelled

        [JsonPropertyName("progress")]
        public int Progress { get; set; } = 0;

        [JsonPropertyName("timestamp")]
        public long Timestamp { get; set; }

        [JsonPropertyName("completedAt")]
        public long? CompletedAt { get; set; }

        [JsonPropertyName("lastPlaybackPosition")]
        public long LastPlaybackPosition { get; set; } = 0;

        [JsonPropertyName("error")]
        public string? Error { get; set; }
    }
}

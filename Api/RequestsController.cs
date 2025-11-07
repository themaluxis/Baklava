using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Serialization;
using System.Net.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace Baklava.Api
{
    [ApiController]
    [Route("api/myplugin/requests")]
    [Produces("application/json")]
    public class RequestsController : ControllerBase
    {
        private readonly ILogger<RequestsController> _logger;

        public RequestsController(ILogger<RequestsController> logger)
        {
            _logger = logger;
        }

        [HttpGet]
        public ActionResult<List<MediaRequest>> GetRequests()
        {
            _logger.LogInformation("[RequestsController] GET called");
            
            var config = Plugin.Instance?.Configuration;
            if (config == null)
            {
                _logger.LogWarning("[RequestsController] Config is null");
                return Ok(new List<MediaRequest>());
            }

            var requests = config.Requests ?? new List<MediaRequest>();
            _logger.LogInformation($"[RequestsController] Returning {requests.Count} requests");
            return Ok(requests);
        }

        [HttpPost]
        public ActionResult<MediaRequest> CreateRequest([FromBody] MediaRequest request)
        {
            _logger.LogInformation("[RequestsController] POST called");
            
            var config = Plugin.Instance?.Configuration;
            if (config == null)
            {
                _logger.LogWarning("[RequestsController] Config is null");
                return BadRequest("Plugin configuration not available");
            }

            if (request == null)
            {
                return BadRequest("Request data is required");
            }

            // Auto-generate ID if not provided
            if (string.IsNullOrEmpty(request.Id))
            {
                request.Id = $"{request.Username}_{request.TmdbId}_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
            }

            // Normalize and ensure media type fields are set
            request.ItemType = (request.ItemType ?? string.Empty).ToLowerInvariant();
            if (string.IsNullOrEmpty(request.TmdbMediaType))
            {
                request.TmdbMediaType = request.ItemType == "series" ? "tv" : "movie";
            }

            // Server-side validation: if we have an IMDB id, prefer TMDB's tv_results mapping
            // This avoids saving a movie tmdbId when the IMDB maps to a TV show.
            try
            {
                if (!string.IsNullOrEmpty(request.ImdbId))
                {
                    var cfg = Plugin.Instance?.Configuration;
                    var apiKey = cfg?.TmdbApiKey;
                    if (!string.IsNullOrEmpty(apiKey))
                    {
                        var tmdbFindUrl = $"https://api.themoviedb.org/3/find/{Uri.EscapeDataString(request.ImdbId)}?api_key={Uri.EscapeDataString(apiKey)}&external_source=imdb_id";
                        using (var http = new HttpClient())
                        {
                            var resp = http.GetAsync(tmdbFindUrl).GetAwaiter().GetResult();
                            if (resp.IsSuccessStatusCode)
                            {
                                var content = resp.Content.ReadAsStringAsync().GetAwaiter().GetResult();
                                using (var doc = System.Text.Json.JsonDocument.Parse(content))
                                {
                                    var root = doc.RootElement;
                                    if (root.TryGetProperty("tv_results", out var tvResults) && tvResults.GetArrayLength() > 0)
                                    {
                                        var first = tvResults[0];
                                        if (first.TryGetProperty("id", out var idProp))
                                        {
                                            request.TmdbId = idProp.GetRawText().Trim('"');
                                            request.TmdbMediaType = "tv";
                                            request.ItemType = "series";
                                        }
                                    }
                                    else if (root.TryGetProperty("movie_results", out var movieResults) && movieResults.GetArrayLength() > 0)
                                    {
                                        var first = movieResults[0];
                                        if (first.TryGetProperty("id", out var idProp))
                                        {
                                            request.TmdbId = idProp.GetRawText().Trim('"');
                                            request.TmdbMediaType = "movie";
                                            request.ItemType = "movie";
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[RequestsController] TMDB find check failed for imdbId={ImdbId}", request.ImdbId);
            }

            // Set default status
            if (string.IsNullOrEmpty(request.Status))
            {
                request.Status = "pending";
            }

            // Set timestamp
            request.Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

            // Add to list
            if (config.Requests == null)
            {
                config.Requests = new List<MediaRequest>();
            }
            
            config.Requests.Add(request);
            Plugin.Instance.SaveConfiguration();

            _logger.LogInformation($"[RequestsController] Created request: {request.Id}");
            return Ok(request);
        }

        [HttpPut("{id}")]
        public ActionResult UpdateRequest(string id, [FromBody] UpdateRequestDto update)
        {
            _logger.LogInformation($"[RequestsController] PUT called for {id}");
            
            var config = Plugin.Instance?.Configuration;
            if (config == null)
            {
                _logger.LogWarning("[RequestsController] Config is null");
                return BadRequest("Plugin configuration not available");
            }

            var request = config.Requests?.FirstOrDefault(r => r.Id == id);
            if (request == null)
            {
                return NotFound($"Request {id} not found");
            }

            // Update fields
            if (!string.IsNullOrEmpty(update.Status))
            {
                request.Status = update.Status;
            }
            
            if (!string.IsNullOrEmpty(update.ApprovedBy))
            {
                request.ApprovedBy = update.ApprovedBy;
            }

            Plugin.Instance.SaveConfiguration();
            _logger.LogInformation($"[RequestsController] Updated request {id}: status={request.Status}");
            return Ok();
        }

        [HttpDelete("{id}")]
        public ActionResult DeleteRequest(string id)
        {
            _logger.LogInformation($"[RequestsController] DELETE called for {id}");
            
            var config = Plugin.Instance?.Configuration;
            if (config == null)
            {
                _logger.LogWarning("[RequestsController] Config is null");
                return BadRequest("Plugin configuration not available");
            }

            var request = config.Requests?.FirstOrDefault(r => r.Id == id);
            if (request == null)
            {
                return NotFound($"Request {id} not found");
            }

            config.Requests.Remove(request);
            Plugin.Instance.SaveConfiguration();

            _logger.LogInformation($"[RequestsController] Deleted request {id}");
            return Ok();
        }
    }

    public class MediaRequest
    {
        [JsonPropertyName("id")]
        public string Id { get; set; }

        [JsonPropertyName("username")]
        public string Username { get; set; }

        [JsonPropertyName("userId")]
        public string UserId { get; set; }

        [JsonPropertyName("timestamp")]
        public long Timestamp { get; set; }

        [JsonPropertyName("title")]
        public string Title { get; set; }

        [JsonPropertyName("year")]
        public string Year { get; set; }

        [JsonPropertyName("img")]
        public string Img { get; set; }

        [JsonPropertyName("imdbId")]
        public string ImdbId { get; set; }

        [JsonPropertyName("tmdbId")]
        public string TmdbId { get; set; }

        [JsonPropertyName("jellyfinId")]
        public string JellyfinId { get; set; }

        [JsonPropertyName("itemType")]
        public string ItemType { get; set; }

    [JsonPropertyName("tmdbMediaType")]
    public string TmdbMediaType { get; set; }

        [JsonPropertyName("status")]
        public string Status { get; set; }

        [JsonPropertyName("approvedBy")]
        public string ApprovedBy { get; set; }
    }

    public class UpdateRequestDto
    {
        [JsonPropertyName("status")]
        public string Status { get; set; }

        [JsonPropertyName("approvedBy")]
        public string ApprovedBy { get; set; }
    }
}

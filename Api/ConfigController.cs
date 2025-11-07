using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace Baklava.Api
{
    [ApiController]
    [Route("api/myplugin/config")]
    [Produces("application/json")]
    public class ConfigController : ControllerBase
    {
        private readonly ILogger<ConfigController> _logger;

        public ConfigController(ILogger<ConfigController> logger)
        {
            _logger = logger;
        }

        [HttpGet]
        public ActionResult<object> GetConfig()
        {
            var cfg = Plugin.Instance?.Configuration;
            if (cfg == null) return BadRequest("Configuration not available");
            return Ok(new { defaultTmdbId = cfg.DefaultTmdbId, tmdbApiKey = cfg.TmdbApiKey });
        }

        // Admin-only update: requires authenticated admin user
        [HttpPut]
        [Authorize]
        public ActionResult SetConfig([FromBody] ConfigDto dto)
        {
            // Basic admin check
            var user = HttpContext.User;
            var isAdmin = user?.IsInRole("Administrator") ?? false;
            if (!isAdmin)
            {
                return Forbid();
            }

            var cfg = Plugin.Instance?.Configuration;
            if (cfg == null) return BadRequest("Configuration not available");

            cfg.DefaultTmdbId = dto?.defaultTmdbId?.Trim();
            cfg.TmdbApiKey = dto?.tmdbApiKey?.Trim();
            Plugin.Instance.SaveConfiguration();
            _logger.LogInformation("[ConfigController] Updated DefaultTmdbId");
            return Ok();
        }
    }

    public class ConfigDto
    {
        public string defaultTmdbId { get; set; }
        public string tmdbApiKey { get; set; }
    }
}

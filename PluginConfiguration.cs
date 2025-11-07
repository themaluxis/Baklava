using System.Collections.Generic;
using MediaBrowser.Model.Plugins;
using Baklava.Api;

namespace Baklava
{
    // Holds settings for your plugin. Add properties here to persist configuration.
    public class PluginConfiguration : BasePluginConfiguration
    {
        // Stored list of requests
        public List<MediaRequest> Requests { get; set; } = new List<MediaRequest>();

        // Optional configuration values used by the API
        // Default TMDB ID to show on the config page
        public string DefaultTmdbId { get; set; } = string.Empty;

        // TMDB API key for metadata lookups
        public string TmdbApiKey { get; set; } = string.Empty;
    }
}

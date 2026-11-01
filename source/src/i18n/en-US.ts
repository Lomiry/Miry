import type { MessageKey } from "./zh-CN";
export const enUS: Record<MessageKey, string> = {
  "detail.playback_choices": "Playback choices",
  "detail.selection_unavailable":
    "The server's playback stream does not support the selected track. Choose another track or restore automatic selection.",
  "detail.source": "Media source",
  "detail.subtitle": "Subtitle selection",
  "detail.audio": "Audio selection",
  "detail.auto_source": "Choose the best source automatically",
  "detail.follow_preferences": "Follow playback preferences",
  "detail.no_tracks": "No tracks available",
  "detail.subtitles_off": "Subtitles off",
  "detail.no_source_metadata":
    "Sources and tracks are resolved on playback. Open an episode's details to choose its tracks.",
  "detail.selection_ready":
    "Ready for this playback. Changing sources resets the track choices.",
  "detail.auto_source_hint":
    "Choose the best playable source before playback, or select one manually. Missing metadata preserves server order.",
  "detail.best_source_policy": "Best source criterion",
  "detail.highest_resolution": "Highest resolution",
  "detail.highest_bitrate": "Highest bitrate",
  "search.page": "Search results",
  "search.all_connections": "Search all signed-in servers",
  "search.server_groups": "{count} server groups",
  "search.loading": "Searching all servers…",
  "search.filters": "Search filters",
  "search.filters_active": "Filters applied · conditions below",
  "search.filters_all": "All types, years and watch states",
  "sources.group_selection": "Source selection",
  "sources.group_credentials": "TOKEN and credentials",
  "sources.group_http": "HTTP consent and connection security",
  "sources.key_edit_hint":
    "Saved keys are never shown. Leave blank to keep the key; enter a new ordinary TOKEN and save to replace it.",
  "search.displayed_count": "{count} items shown on this page",
  "search.primary_count": "{count} primary results",
  "search.supplemental_count": "{count} possible matches (not primary results)",
  "player.embedded_subtitles": "Embedded subtitles",
  "player.external_subtitles": "External subtitles",
  "player.external_subtitles_help":
    "Subtitles supplied by this media appear here after loading. Local subtitle file import is not available in this player.",
  "player.back_to_subtitles": "Back to subtitles",
  "player.external_subtitle_failed":
    "External subtitles could not be loaded. Video playback continues.",
  "routeUi.saved": "Server display settings saved",
  "routeUi.save_failed":
    "Could not save settings. Check local storage and retry",
  "routeUi.icon_unknown":
    "Settings saved, but this provider has no catalog icon. Using Emby; you can set a custom HTTPS icon",
  "routeUi.icon_loading": "Loading provider icon",
  "routeUi.icon_loaded": "Provider icon loaded",
  "routeUi.icon_fallback":
    "Using the local Emby icon (no match or image unavailable)",
  "routeUi.catalog_loaded": "Icon catalog updated: {count} entries",
  "library.render_failed": "This list could not be displayed",
  "library.render_preserved":
    "Your library and filters are preserved. Retry the list or select another library.",
  "library.retry_view": "Retry this list",
  "library.error_details": "Error details",
  "danmaku.confirm_match": "Confirm this match",
  "danmaku.choose_other_match": "Choose another match",
  "danmaku.candidate_match": "Candidate matches (not confirmed)",
  "danmaku.confirmed_match": "Confirmed match",
  "danmaku.loaded_match": "Automatic match loaded",
  "danmaku.loaded_comments": "Loaded {count} comments",
  "danmaku.version_warning":
    "This candidate has a different year, season, episode or type; I confirm this version",
  "danmaku.source_attempts":
    "Source attempt history (not current match status)",
  "danmaku.match_unchanged": "Confirmation cancelled; current match unchanged",
  "danmaku.match_action_failed":
    "Could not complete matching. Retry or search again",
  "danmaku.candidate_expired":
    "Candidate expired. Search again for the current media",
  "routeUi.title": "Server and routes",
  "routeUi.description": "Manage connection addresses and server display",
  "routeUi.add": "Add route",
  "routeUi.diagnostics": "Connection diagnostics",
  "routeUi.server_details": "Server name and icon",
  "routeUi.ignore_tls": "Ignore SSL certificate validation for this route",
  "routeUi.logout_confirm":
    "Sign out of the current server? Its saved login on this device will be cleared.",
  "routeUi.brand_hint":
    "Explicit provider brands and custom icons stay after renaming. Empty fields match the current remark exactly; unknown names use the generic server icon.",
  "player.mini_window": "Mini player",
  "player.restore_player": "Restore player",
  "player.exit_mini": "Exit Mini Player",
  "player.applying_action": "Working…",
  "player.control_layout": "Control layout",
  "player.layout_minimal": "Minimal",
  "player.layout_standard": "Standard (recommended)",
  "player.layout_full": "Full",
  "player.layout_custom": "Custom",
  "player.layout_help":
    "Changes are saved automatically. Play, timeline, return and More remain available. Hidden tools are accessible in More.",
  "player.move_control_up": "Move {name} up",
  "player.move_control_down": "Move {name} down",
  "player.audio_and_subtitles": "Audio and subtitles",
  "player.picture_and_window": "Picture and window",
  "library.browse_mode": "Browse mode",
  "library.browse_pages": "Pages",
  "library.browse_infinite": "Infinite scroll",
  "library.resolution_uses_pages":
    "Resolution filtering uses pages and builds a library metadata index on first use. Clear the resolution filter to choose infinite scroll again.",
  "library.loaded_count": "{count} items loaded",
  "library.load_more": "Load more",
  "library.retry_batch": "Retry loading",
  "library.repeated_batch":
    "The server returned an already loaded batch. Retry or refresh the list.",
  "library.end_of_list": "End of list",
  "library.supplemental_matches": "More possible matches",
  "library.supplemental_hint":
    "Matches names and original titles within limited candidates; some titles may be missing.",
  "routeC.duplicate_route":
    "This address already exists. Edit the existing route.",
  "routeC.tls_images":
    "Media artwork still uses system certificate validation. This option does not guarantee artwork from an invalid-certificate server will display.",
  "routeC.max_routes": "A maximum of 20 routes can be saved.",
  "routeC.import": "Smart import",
  "routeC.import_note":
    "Paste connection instructions, preview an address and fill the form below. Review it before connecting. Addresses without a protocol preview as HTTPS.",
  "routeC.preview_hint":
    "Choose an address, then edit account details in the connection form below. Multiple addresses require separate account details.",
  "routeC.username_found": "Username detected",
  "routeC.username_manual": "Username needed",
  "routeC.password_found": "Password detected",
  "routeC.password_manual": "No password provided",
  "routeC.paste": "Paste connection instructions",
  "routeC.preview": "Parse and preview",
  "routeC.no_candidates":
    "No valid addresses found. Enter the connection manually.",
  "routeC.candidate": "Candidate",
  "routeC.use_candidate": "Fill connection form",
  "routeC.ignore_tls":
    "Advanced: ignore SSL certificate validation for this route",
  "routeC.tls_warning":
    "This route cannot verify the server certificate and may be intercepted or impersonated. Enable only if you trust this route and understand the risk. Other routes and app updates are unaffected.",
  "routeC.desktop_tls":
    "Certificate compatibility is available only in the desktop client.",
  "routeC.edit": "Edit server and routes",
  "routeC.edit_route": "Edit route",
  "routeC.save": "Save changes",
  "routeC.pending": "Pending verification (never selected automatically)",
  "routeC.keep_pending": "Save as pending route",
  "routeC.enabled": "Enable route",
  "routeC.priority": "Priority (lower comes first)",
  "routeC.active_protected":
    "Switch to another route before disabling the current route.",
  "routeC.icon": "Provider icon",
  "routeC.provider": "Provider name (exact match)",
  "routeC.icon_url": "Custom icon HTTPS URL (overrides automatic match)",
  "routeC.icon_refresh": "Load Lige icon catalog",
  "routeC.icon_source":
    "Icons: lige47 / Lige icon collection, used with attribution. External images load independently.",
  "routeC.icon_failed": "Catalog unavailable. Using the local Emby icon.",
  "routeC.identity_changed":
    "Server identity differs. Reusing this account was blocked. Add it as a new server.",
  "sources.error_network": "Connection failed or request timed out",
  "sources.error_auth": "Authentication failed; check the ordinary TOKEN",
  "sources.error_rate": "Service rate limit reached",
  "sources.error_data": "Invalid response format",
  "sources.error_match": "No match found",
  "sources.error_empty": "No comments for this match",
  "sources.error_manual": "Match needs manual confirmation",
  "sources.error_service": "Service is unavailable",
  "sources.title": "Danmaku sources",
  "sources.hint":
    "Compatible with LogVar/danmu_api v2. Auto mode tries lower priority numbers first and uses one source.",
  "sources.mode": "Danmaku source",
  "sources.auto": "Automatic (priority fallback)",
  "sources.priority": "Priority",
  "sources.edit": "Edit",
  "sources.check": "Check connection",
  "sources.remove": "Delete",
  "sources.add": "Add LogVar / compatible API",
  "sources.name": "Name",
  "sources.endpoint": "Service URL (without TOKEN or /api/v2)",
  "sources.token": "Ordinary TOKEN (leave blank to keep the saved key)",
  "sources.token_hint":
    "Keys use Windows user-level encrypted storage and are restored after restart. Changing Windows users or reinstalling Windows may require configuration again.",
  "sources.save": "Save source",
  "sources.cancel": "Cancel",
  "sources.invalid": "Check the name, service URL and key format.",
  "sources.key_failed": "Could not save the key. Retry in the main window.",
  "sources.healthy":
    "API connection passed; media matching and comments still need playback verification.",
  "sources.health_failed": "Connection check failed: {kind}",
  "sources.using": "Currently using: {name}",
  "sources.disabled": "Disabled",
  "sources.service": "Online matching and danmaku service",
  "sources.clear_key": "Clear saved TOKEN",
  "sources.key_cleared":
    "TOKEN and ciphertext backup cleared. Enter it again if authentication is required.",
  "sources.saved": "Source saved.",
  "sources.removed": "Source and its saved credentials deleted.",
  "sources.mode_hint":
    "The selector controls the active source. Adding or editing a source does not switch playback sources.",
  "sources.edit_hint":
    "Editing a LogVar source. After saving, select it above or use automatic mode.",
  "sources.name_invalid":
    "Enter a source name of 1–60 characters without control characters.",
  "sources.endpoint_empty": "Enter the LogVar service URL.",
  "sources.priority_invalid": "Priority must be an integer from 0 to 99.",
  "sources.endpoint_invalid":
    "Invalid service URL. Public servers require HTTPS; loopback supports HTTP, and private IPv4 HTTP requires consent. Exclude TOKEN, /api/v2, credentials, queries and fragments.",
  "sources.endpoint_hint":
    "Public servers require HTTPS; loopback supports HTTP, and private IPv4 HTTP requires consent. Enter an ordinary TOKEN only, never ADMIN_TOKEN.",
  "sources.lan_http_warning":
    "This source uses LAN HTTP. Your TOKEN is sent without encryption. Use it only on a trusted network.",
  "sources.lan_http_confirm":
    "I understand the risk and allow LAN HTTP for this source",
  "sources.lan_http_required":
    "Confirm the LAN HTTP transport risk before saving this source.",
  "sources.group_basic": "Source details",
  "sources.group_security": "Security and authentication",
  "sources.group_behavior": "Source behavior",
  "sources.group_notes": "Storage and usage",
  "sources.token_invalid":
    "Ordinary TOKEN must be at most 512 bytes, without control characters or surrounding whitespace.",
  "sources.token_missing":
    "No ordinary TOKEN configured. Enter an authorized TOKEN, or select no TOKEN only for anonymous APIs.",
  "sources.key_saved":
    "An encrypted TOKEN is saved. Leave blank to keep it, or enter a new TOKEN to replace it.",
  "sources.key_session":
    "A session TOKEN exists. Save the source to encrypt it for restoration after restart.",
  "sources.key_missing":
    "No saved TOKEN. Edit the source to configure authentication if required.",
  "sources.key_checking": "Reading credential status…",
  "sources.key_unavailable":
    "Credential read or decryption failed. The old ciphertext was not overwritten. Enter a TOKEN and explicitly replace it.",
  "sources.endpoint_changed":
    "The service URL changed. The old TOKEN cannot be used at the new address. Enter a new TOKEN or explicitly select anonymous access.",
  "sources.encrypt_failed":
    "Windows user-level encryption failed. The source was not saved. Check DPAPI availability for this Windows user.",
  "sources.permission_failed":
    "Could not secure the credential directory for the current Windows user. Check application data permissions.",
  "sources.storage_failed":
    "Could not write the credential file. Check disk space and application data permissions.",
  "sources.settings_failed":
    "Source save failed: local settings are not writable. Credential changes were rolled back. Check storage permissions or space.",
  "sources.save_failed":
    "Source save failed. Retry and keep the editor open until success is confirmed.",
  "sources.rollback_failed":
    "The save was incomplete and the previous state could not be restored. Reopen source management to check settings and credentials; do not treat this as success.",
  "sources.stale":
    "The source was removed or changed. Reopen the editor before saving.",
  "sources.anonymous":
    "This API needs no TOKEN (saving clears any existing key)",
  "sources.enabled": "Enable this source",
  "sources.save_recover": "Replace unreadable key and save source",
  "sources.native_required":
    "Save encrypted credentials in the main window of Miry for Windows.",
  "library.connection_failed": "Connection failed",
  "network.enter_the_full_server_address_for_example":
    "Enter the full server address, for example https://emby.example.com",
  "network.use_an_http_or_https_address_without":
    "Use an HTTP or HTTPS address without credentials, query parameters, or a fragment.",
  "network.media_downloads_are_unavailable_in_this_client":
    "Media downloads are unavailable in this client.",
  "network.creating_server_playlists_is_unavailable_in_this":
    "Creating server playlists is unavailable in this client.",
  "network.your_session_has_expired_or_the_username":
    "Your session has expired or the username or password is incorrect. Sign in again.",
  "network.access_denied_check_your_account_permissions":
    "Access denied. Check your account permissions.",
  "network.the_server_does_not_provide_this_api":
    "The server does not provide this API (HTTP 404). Check the server path.",
  "network.the_server_cannot_process_the_request_right":
    "The server cannot process the request right now (HTTP {p0}). Try again later.",
  "network.the_server_returned_http_check_the_address":
    "The server returned HTTP {p0}. Check the address or try again later.",
  "network.the_server_response_is_not_valid_emby":
    "The server response is not valid Emby JSON.",
  "network.the_request_exceeded_15_seconds_check_your":
    "The request exceeded 15 seconds. Check your server connection and try again.",
  "network.the_client_cannot_access_this_address_or":
    "The client cannot access this address or port. Update the desktop app.",
  "network.the_server_hostname_could_not_be_resolved":
    "The server hostname could not be resolved. Check your network.",
  "network.could_not_connect_to_the_server_check":
    "Could not connect to the server. Check the port and network.",
  "network.the_tls_connection_or_certificate_validation_failed":
    "The TLS connection or certificate validation failed. Check connection diagnostics.",
  "network.the_server_connection_timed_out_try_again":
    "The server connection timed out. Try again later.",
  "network.could_not_connect_to_the_server_check_2":
    "Could not connect to the server. Check the network, address, and certificate.",
  "network.could_not_connect_to_the_server_browser":
    "Could not connect to the server. Browser previews require the server to allow cross-origin access; the desktop app uses native requests.",
  "network.the_server_did_not_return_valid_sign":
    "The server did not return valid sign-in information.",
  "network.server_check_failed_the_response_is_not":
    "Server check failed: the response is not valid Emby ServerInfo.",
  "network.the_server_did_not_confirm_the_favorite":
    "The server did not confirm the favorite status. Refresh and try again.",
  "library.movies": "Movies",
  "library.tv_shows": "TV shows",
  "library.name": "Name",
  "library.date_added": "Date added",
  "library.release_year": "Release year",
  "library.community_rating": "Community rating",
  "library.duration": "Duration",
  "library.last_played": "Last played",
  "library.play_count": "Play count",
  "library.this_library_exceeds_the_resolution_index_limit":
    "This library exceeds the resolution index limit. Select a smaller library and try again.",
  "library.resolution_metadata_is_incomplete_try_again":
    "Resolution metadata is incomplete. Try again.",
  "library.the_library_has_changed_refresh_the_resolution":
    "The library has changed. Refresh the resolution filter.",
  "library.ascending_switch_to_descending": "Ascending; switch to descending",
  "library.descending_switch_to_ascending": "Descending; switch to ascending",
  "library.currently_ascending_switch_to_descending":
    "Currently ascending; switch to descending",
  "library.currently_descending_switch_to_ascending":
    "Currently descending; switch to ascending",
  "library.search_sorting_depends_on_server_support_if":
    "Search sorting depends on server support. If the order stays the same, filter and sort within a library.",
  "library.added_to_watch_later": "Added to Watch Later",
  "library.removed_from_watch_later": "Removed from Watch Later",
  "library.could_not_save_watch_later_check_your":
    "Could not save Watch Later. Check your local storage space.",
  "library.the_page_is_not_ready_yet": "The page is not ready yet",
  "library.open_the_desktop_app_to_play_media":
    "Open the desktop app to play media.",
  "library.sign_in_to_a_server_first": "Sign in to a server first.",
  "library.the_server_did_not_return_the_series":
    "The server did not return the series for this episode.",
  "library.added_to_favorites": "Added to favorites",
  "library.removed_from_favorites": "Removed from favorites",
  "library.switching_connections_try_again_shortly":
    "Switching connections. Try again shortly.",
  "library.the_recommended_route_is_unavailable_select_a":
    "The recommended route is unavailable. Select a route manually.",
  "library.playback_position_saved_locally_server_sync_failed":
    "Playback position saved locally; server sync failed",
  "library.playback_stopped": "Playback stopped",
  "library.continue_watching_is_unavailable_right_now":
    "Continue Watching is unavailable right now.",
  "library.could_not_load_the_biography_try_again":
    "Could not load the biography. Try again.",
  "library.could_not_load_content_try_again":
    "Could not load content. Try again.",
  "library.could_not_exit_playback_try_again":
    "Could not exit playback. Try again.",
  "library.remove_viewing_history_for": "Remove viewing history for {p0}",
  "library.remove_this_viewing_history_entry":
    "Remove this viewing history entry",
  "library.remove_entry": "Remove entry",
  "library.play": "Play",
  "library.home": "Home",
  "library.watch_later": "Watch Later",
  "library.collections": "Collections",
  "library.playlists": "Playlists",
  "library.viewing_history": "Viewing History",
  "library.my_favorites": "My Favorites",
  "library.search_results_for": "Search results for “{p0}”",
  "library.all_movies": "All Movies",
  "library.all_tv_shows": "All TV Shows",
  "library.all_media": "All Media",
  "library.back_to_home": "Back to Home",
  "library.current_server": "Current server",
  "library.demo_mode": "Demo mode",
  "library.add_server": "Add Server",
  "library.main_navigation": "Main navigation",
  "library.favorites": "Favorites",
  "library.connection_routes": "Connection routes",
  "library.my_libraries": "My libraries",
  "library.libraries": "Libraries",
  "library.manage_libraries": "Manage Libraries",
  "library.settings": "Settings",
  "library.d": "D",
  "library.sign_out": "Sign Out",
  "library.page_navigation_and_search": "Page navigation and search",
  "library.exit_playback": "Exit playback",
  "library.go_back": "Go back",
  "library.go_to_home": "Go to Home",
  "library.back_to_library": "Back to library {p0}",
  "library.all_servers": "All Servers",
  "library.refresh": "Refresh",
  "library.related_titles": "Related titles",
  "library.loading": "Loading",
  "library.at_least": "At least ",
  "library.minimum_count": "At least {count}",
  "library.filter_filmography": "Filter filmography",
  "library.all": "All",
  "library.items": "{p0}{p1} items",
  "library.clear_watch_later": "Clear Watch Later",
  "library.clear_viewing_history": "Clear Viewing History",
  "library.sort": "Sort",
  "library.sort_media": "Sort media",
  "library.watch_status": "Watch status",
  "library.unwatched": "Unwatched",
  "library.watched": "Watched",
  "library.media_pagination": "Media pagination",
  "library.favorites_2": "favorites",
  "library.results": "results",
  "library.could_not_load_favorites_from_this_server":
    "Could not load favorites from this server",
  "library.search_failed_on_this_server": "Search failed on this server",
  "library.no_favorites_yet": "No favorites yet",
  "library.no_results_found": "No results found",
  "library.favorite_movies_and_tv_shows_to_see":
    "Favorite movies and TV shows to see them here.",
  "library.try_different_search_terms": "Try different search terms.",
  "library.watch_later_is_empty": "Watch Later is empty",
  "library.no_viewing_history_yet": "No viewing history yet",
  "library.no_collections_yet": "No collections yet",
  "library.no_playlists_yet": "No playlists yet",
  "library.this_collection_is_empty": "This collection is empty",
  "library.this_playlist_is_empty": "This playlist is empty",
  "library.no_content_here_yet": "No content here yet",
  "library.select_favorite_on_a_poster_or_details":
    "Select Favorite on a poster or details page to see your favorites here.",
  "library.add_movies_or_tv_shows_to_watch":
    "Add movies or TV shows to Watch Later to find them easily next time.",
  "library.your_local_viewing_history_appears_here_after":
    "Your local viewing history appears here after playback begins.",
  "library.the_server_has_no_titles_listed_for":
    "The server has no titles listed for this person.",
  "library.select_another_library_or_refresh_later":
    "Select another library or refresh later.",
  "library.similar_titles": "Similar titles",
  "library.pagination_at_the_end_of_the_list":
    "Pagination at the end of the list",
  "library.recommended": "Recommended",
  "library.close_queue": "Close queue",
  "library.could_not_clear_the_interrupted_playback_record":
    "Could not clear the interrupted playback record. Try again.",
  "library.cancel_adding_server": "Cancel adding server",
  "library.connection_cancelled": "Connection cancelled.",
  "library.server_check_failed": "Server check failed",
  "library.sign_in_failed": "Sign-in failed",
  "library.connect_to_your_library": "Connect to your library",
  "library.connection_intro": "An Emby desktop client designed for Windows.",
  "connection.play_title": "Native playback. Room to browse.",
  "connection.play_body":
    "Play with mpv and keep browsing your library while the mini player runs.",
  "connection.danmaku_title": "Danmaku and subtitles",
  "connection.danmaku_body":
    "Manage sources and density, switch audio tracks and use dual subtitles.",
  "connection.routes_title": "Flexible server connections",
  "connection.routes_body":
    "Import server details and manage route priorities and individual SSL options.",
  "library.emby_server": "Emby server",
  "library.advanced_connection_settings": "Advanced connection settings",
  "library.connect": "Connect",
  "library.anonymous_diagnostics_copied_addresses_passwords_and_tokens":
    "Anonymous diagnostics copied. Addresses, passwords, and tokens are excluded.",
  "library.could_not_copy_diagnostics_check_clipboard_permissions":
    "Could not copy diagnostics. Check clipboard permissions.",
  "library.copy_anonymous_diagnostics": "Copy Anonymous Diagnostics",
  "library.server_address": "Server address",
  "library.paste_server_address": "Paste server address",
  "library.remark_optional": "Remark (optional)",
  "library.server_remark": "Server remark",
  "library.for_example_home_library": "For example: Home library",
  "library.username": "Username",
  "library.password": "Password",
  "library.remember_me_only_on_your_own_computer":
    "Remember me (only on your own computer)",
  "library.checking_server": "Checking server…",
  "library.connected_signing_in": "Connected. Signing in…",
  "library.connect_to_server": "Connect to Server",
  "library.cancel_connection": "Cancel Connection",
  "library.or_try_it_first": "Or try it first",
  "library.open_demo_library": "Open Demo Library",
  "library.your_password_is_never_saved_sign_in":
    "Your password is never saved. Sign-in lasts for the current session unless you select Remember me, which stores an access token locally.",
  "settings.appearance": "Appearance",
  "settings.system": "System",
  "settings.light": "Light",
  "settings.dark": "Dark",
  "settings.interface_text_size": "Interface text size",
  "settings.standard": "Standard",
  "settings.larger": "Larger",
  "settings.large": "Large",
  "library.loading_collection_artwork": "Loading collection artwork",
  "library.collection_collage": "· Collection collage",
  "library.media_is_unavailable_right_now": "Media is unavailable right now",
  "library.retry": "Retry",
  "danmaku.online_danmaku": "Online danmaku",
  "danmaku.automatically_match_online_danmaku":
    "Automatically match online danmaku",
  "danmaku.show_danmaku": "Show danmaku",
  "danmaku.danmaku_font_size": "Danmaku font size",
  "danmaku.danmaku_opacity": "Danmaku opacity",
  "danmaku.danmaku_scroll_speed": "Danmaku scroll speed",
  "danmaku.original_speed_retained": "× · Original speed retained",
  "danmaku.danmaku_display_area": "Danmaku display area",
  "danmaku.the_bottom_area_is_reserved_for_subtitles":
    "The bottom area is reserved for subtitles by default",
  "danmaku.top_50": "Top 50%",
  "danmaku.top_75": "Top 75%",
  "danmaku.fullscreen": "Fullscreen",
  "danmaku.danmaku_density": "Danmaku density",
  "danmaku.low_up_to_24_comments": "Low · Up to 24 comments",
  "danmaku.standard_up_to_48_comments": "Standard · Up to 48 comments",
  "danmaku.high_up_to_96_comments": "High · Up to 96 comments",
  "danmaku.danmaku_time_offset_seconds": "Danmaku time offset (seconds)",
  "danmaku.positive_values_delay_comments_negative_values_advance":
    "Positive values delay comments; negative values advance them. Offsets in the player menu are saved for the current match or file.",
  "danmaku.hide_duplicate_comments": "Hide duplicate comments",
  "danmaku.hide_colored_comments": "Hide colored comments",
  "danmaku.hide_top_comments": "Hide top comments",
  "danmaku.hide_bottom_comments": "Hide bottom comments",
  "danmaku.hide_very_long_comments": "Hide very long comments",
  "settings.version_is_available": "Version {p0} is available",
  "settings.you_re_up_to_date": "You're up to date",
  "settings.could_not_check_for_updates": "Could not check for updates. {p0}",
  "settings.anonymous_diagnostics_saved": "Anonymous diagnostics saved: {p0}",
  "settings.online_danmaku_is_provided_by_the_play":
    "Online danmaku is provided by the 弹弹play open danmaku network · www.dandanplay.com. Access is included in release builds; title availability depends on the service.",
  "settings.an_emby_mpv_client_for_windows_updates":
    "An Emby + mpv client for Windows. Updates check the version, release notes, and release page. You choose whether to install them.",
  "settings.windows_media_controls": "Windows media controls",
  "settings.sync_playback_status_and_system_media_keys":
    "Sync playback status and system media keys; app controls remain available if unsupported",
  "settings.check_for_updates": "Check for Updates",
  "settings.github_releases": "GitHub Releases",
  "settings.export_anonymous_diagnostics": "Export Anonymous Diagnostics",
  "settings.view_release_page": "View Release Page",
  "library.could_not_load_episodes": "Could not load episodes.",
  "library.episodes": "Episodes",
  "library.season": "Season",
  "library.select_season": "Select season",
  "library.view_details_for": "View details for {p0}",
  "library.this_season": "This season",
  "library.loading_episodes": "Loading episodes",
  "library.loading_episodes_2": "Loading episodes…",
  "library.episodes_are_unavailable_right_now":
    "Episodes are unavailable right now",
  "library.episode": "Episode",
  "library.playing": "Playing",
  "library.continue_watching": "Continue Watching",
  "library.next_episode": "Next episode",
  "library.watched_2": "{p0}% watched",
  "library.min": "· {p0} min",
  "library.no_playable_episodes_right_now": "No playable episodes right now",
  "library.select_another_season_or_refresh_later":
    "Select another season or refresh later.",
  "library.episode_pagination": "Episode pagination",
  "library.remove_favorite": "Remove Favorite",
  "library.featured": "Featured",
  "library.next_up": "Next Up",
  "library.recently_added": "Recently Added",
  "library.details": "Details",
  "library.library_shortcuts": "Library shortcuts",
  "library.open_library": "Open library {p0}",
  "library.your_libraries_are_empty": "Your libraries are empty",
  "library.select_a_library_in_the_sidebar_or":
    "Select a library in the sidebar or refresh and try again.",
  "library.mark_unwatched": "Mark Unwatched",
  "library.mark_watched": "Mark Watched",
  "library.type": "Type",
  "library.media_type": "Media type",
  "library.resolution": "Resolution",
  "library.sd_other": "SD / Other",
  "library.genre": "Genre",
  "library.year": "Year",
  "library.rating": "Rating",
  "library.minimum_rating": "Minimum rating",
  "library.and_above": "and above",
  "library.reset_filters": "Reset Filters",
  "library.settings_were_not_saved_check_your_local":
    "Settings were not saved. Check your local storage space and try again.",
  "library.home_and_sidebar": "Home and sidebar",
  "library.choose_your_favorite_libraries_and_arrange_their":
    "Choose your favorite libraries and arrange their display order.",
  "library.reset_library_preferences": "Reset library preferences",
  "library.restore_defaults": "Restore Defaults",
  "library.library_display_preferences": "Library display preferences",
  "library.show_library": "Show library {p0}",
  "library.move_library_up": "Move library {p0} up",
  "library.move_up": "Move up",
  "library.move_library_down": "Move library {p0} down",
  "library.move_down": "Move down",
  "library.no_libraries_are_available_refresh_and_try":
    "No libraries are available. Refresh and try again.",
  "library.all_library_shortcuts_are_hidden_you_can":
    "All library shortcuts are hidden. You can enable them here.",
  "library.loading_2": "Loading…",
  "library.this_page_is_empty": "This page is empty",
  "library.media_details": "Media details",
  "library.play_titles_on_this_page": "Play Titles on This Page",
  "library.remove_from_watch_later": "Remove from Watch Later",
  "library.add_to_watch_later": "Add to Watch Later",
  "library.no_overview_available": "No overview available",
  "library.show_less": "Show less",
  "library.show_more": "Show more",
  "library.media_information": "Media information",
  "library.video": "Video",
  "library.tv_series": "TV series",
  "library.folder": "Folder",
  "library.playlist": "Playlist",
  "library.view_details_for_2": "View details for {p0}",
  "library.min_2": "{p0} min",
  "library.rating_2": "Rating {p0}",
  "library.no_rating": "No rating",
  "library.min_3": "min",
  "library.watch_progress": "Watch progress",
  "library.view_all": "View all {p0}",
  "library.view_all_2": "View all",
  "library.scroll_left": "Scroll {p0} left",
  "library.scroll_right": "Scroll {p0} right",
  "library.content": "{p0} content",
  "danmaku.online_matching_play_open_danmaku_network":
    "Online matching · 弹弹play open danmaku network",
  "danmaku.local_test_service": "· Local test service",
  "danmaku.online_danmaku_is_off": "Online danmaku is off",
  "danmaku.configure_authorized_service_credentials":
    "Configure Authorized Service Credentials",
  "danmaku.search_for_other_danmaku": "Search for Other Danmaku",
  "danmaku.change_match": "Change Match",
  "danmaku.reload_online_danmaku": "Reload Online Danmaku",
  "danmaku.use_online_danmaku": "Use Online Danmaku",
  "danmaku.search_online_danmaku": "Search online danmaku",
  "danmaku.search": "Search",
  "danmaku.play": "· 弹弹play",
  "danmaku.service_configuration": "Service Configuration",
  "danmaku.change_credentials": "Change Credentials",
  "danmaku.clear_credentials_for_this_session":
    "Clear Credentials for This Session",
  "library.view_mode": "View mode",
  "library.poster_view": "Poster view",
  "library.list_view": "List view",
  "library.items_per_page": "Items per page",
  "library.custom": "Custom",
  "library.custom_items_per_page": "Custom items per page",
  "library.apply": "Apply",
  "library.enter_a_whole_number_from_to":
    "Enter a whole number from {p0} to {p1}",
  "library.content_pagination": "Content pagination",
  "library.previous": "Previous",
  "library.go_to_page_number": "Go to page number",
  "library.enter_a_whole_page_number_from_1":
    "Enter a whole page number from 1 to {p0}",
  "library.page_range_1_press_enter_or_select":
    "Page range: 1–{p0}. Press Enter or select Go to confirm.",
  "library.go": "Go",
  "library.next": "Next",
  "library.actor": "Actor",
  "library.director": "Director",
  "library.writer": "Writer",
  "library.producer": "Producer",
  "library.composer": "Composer",
  "library.guest_star": "Guest star",
  "library.voice_actor": "Voice actor",
  "library.cast_and_crew": "Cast and crew",
  "library.show_less_2": "Show less",
  "library.view_all_3": "View all · {p0}",
  "library.cast_member": "Cast member",
  "library.view_person": "View person {p0}",
  "library.person_details": "Person details",
  "library.biography": "Biography",
  "library.no_biography_available_from_the_server":
    "No biography available from the server",
  "player.danmaku": "Danmaku",
  "player.subtitles": "Subtitles",
  "player.audio_tracks": "Audio tracks",
  "player.volume": "Volume",
  "player.more": "More",
  "player.playback_speed": "Playback speed",
  "player.chapters": "Chapters",
  "player.a_b_loop": "A–B loop",
  "player.playback_routes": "Playback routes",
  "player.media_version": "Media version",
  "player.playback_settings": "Playback settings",
  "player.play_queue": "Play queue",
  "player.the_action_could_not_be_completed_try":
    "The action could not be completed. Try again.",
  "player.auto_hide_controls": "Auto-hide controls",
  "player.keep_video_window_on_top": "Keep video window on top",
  "player.disable_always_on_top": "Disable always on top",
  "player.always_on_top": "Always on top",
  "player.secondary_subtitles": "Secondary subtitles",
  "player.off": "Off",
  "player.subtitle_size": "Subtitle size",
  "player.subtitle_delay": "Subtitle delay",
  "player.audio_delay": "Audio delay",
  "player.seconds": "(seconds)",
  "player.subtitle_vertical_position": "Subtitle vertical position",
  "player.reset_subtitle_position": "Reset Subtitle Position",
  "player.size_and_position_apply_to_text_subtitles":
    "Size and position apply to text subtitles. ASS/SSA keep their own styles and positioning.",
  "player.buffered": "Buffered",
  "player.seconds_2": "seconds",
  "player.playback_method": "Playback method:",
  "player.direct_stream": "Direct Stream",
  "player.transcoding": "Transcoding",
  "player.direct_play": "Direct Play",
  "player.media": "Media:",
  "player.bit_depth_unknown": "Bit depth unknown",
  "player.on": "On",
  "player.output_policy": "Output policy:",
  "player.unmodified_output": "Unmodified output",
  "player.auto": "Auto",
  "player.actual_output": "Actual output:",
  "player.unmodified_output_requires_system_hdr_currently_falling":
    "Unmodified output requires system HDR. Currently falling back to Auto.",
  "player.tried_the_default_audio_device_and_pcm":
    "Tried the default audio device and PCM fallback",
  "player.dolby_vision_information_is_recognized_full_dv":
    "Dolby Vision information is recognized; full DV output is not guaranteed for every profile.",
  "player.local_file": "Local file",
  "player.using_online_danmaku": "· Using online danmaku",
  "player.no_danmaku_source_selected": "No danmaku source selected",
  "player.select_a_local_bilibili_xml_or_ass":
    "Select a local Bilibili XML or ASS file. It is linked to the current media only.",
  "player.local_danmaku_appears_in_the_embedded_player":
    "Local danmaku appears in the embedded player. Enable “Play within the app” in Settings.",
  "player.choose_another_file": "Choose Another File",
  "player.choose_local_file": "Choose Local File",
  "player.unlink_file": "Unlink File",
  "player.timing_danmaku_settings": "Timing / Danmaku Settings",
  "player.local_danmaku_is_available_only_in_the":
    "Local danmaku is available only in the native player.",
  "player.subtitles_off": "Subtitles off",
  "player.no_subtitles_available_for_this_video":
    "No subtitles available for this video",
  "player.subtitle_size_position_and_delay":
    "Subtitle Size, Position, and Delay",
  "player.audio_off": "Audio off",
  "player.no_audio_tracks_available_for_this_video":
    "No audio tracks available for this video",
  "player.speed": "Speed",
  "player.show": "Show",
  "player.source": "Source",
  "player.routes": "Routes",
  "player.advanced": "Advanced",
  "player.stop_playback": "Stop playback",
  "player.chapter": "Chapter {p0}",
  "player.set_loop_points_at_the_current_playback":
    "Set loop points at the current playback position",
  "player.set_a": "Set A",
  "player.set_b": "Set B",
  "player.clear_loop": "Clear Loop",
  "player.check_api": "Check API",
  "player.sample_throughput": "Sample Throughput",
  "player.playback_resumes_at_the_current_position_after":
    "Playback resumes at the current position after switching routes. Throughput tests read up to 256 KiB with at least 60 seconds between tests per route. Routes are not switched automatically during playback.",
  "player.video_version": "Video version",
  "player.auto_play_next_episode": "Auto-play next episode",
  "player.remove": "Remove {p0}",
  "player.open_player": "Open player",
  "player.buffering": "Buffering…",
  "player.playback_position": "Playback position",
  "player.seek_preview": "Seek preview",
  "player.resume": "Resume",
  "player.pause": "Pause",
  "player.previous_episode": "Previous episode",
  "player.rewind_10_seconds": "Rewind 10 seconds",
  "player.forward_10_seconds": "Forward 10 seconds",
  "player.current_playback_resolution": "Current playback resolution",
  "player.live_network_speed": "Live network speed",
  "player.more_playback_actions": "More playback actions",
  "player.exit_fullscreen": "Exit fullscreen",
  "player.skip_intro": "Skip intro",
  "player.skip_credits": "Skip credits",
  "player.dismiss_skip_prompt": "Dismiss skip prompt",
  "player.current_route_may_be_unstable": "Current route may be unstable ·",
  "player.view_routes": "View Routes",
  "player.don_t_remind_me_this_session": "Don't Remind Me This Session",
  "player.dismiss_route_warning": "Dismiss route warning",
  "player.back_to_more": "Back to More",
  "player.close_playback_settings": "Close playback settings",
  "player.close": "Close {p0}",
  "player.copy_playback_diagnostics": "Copy Playback Diagnostics",
  "player.player_controls_closed": "Player controls closed",
  "player.the_action_timed_out_try_again": "The action timed out. Try again.",
  "player.player_controls": "Player controls",
  "player.demo_titles_have_no_video_files_connect":
    "Demo titles have no video files. Connect to your Emby server to play media.",
  "player.mpv_playback_requires_the_desktop_app_open":
    "mpv playback requires the desktop app. Open Miry.exe.",
  "player.playback_cancelled": "Playback cancelled.",
  "player.playback_preparation_cancelled": "Playback preparation cancelled.",
  "player.preparing_playback": "Preparing playback…",
  "player.resume_2": "Resume · {p0}",
  "player.play_from_beginning": "Play from Beginning",
  "player.cancel_playback_preparation": "Cancel playback preparation",
  "player.anonymous_playback_diagnostics_copied":
    "Anonymous playback diagnostics copied.",
  "player.video_is_playing_in_a_separate_window":
    "Video is playing in a separate window",
  "player.preparing_video": "Preparing video",
  "player.playback_finished": "Playback finished",
  "player.show_video_window": "Show Video Window",
  "player.play_again": "Play Again",
  "player.close_player_panel": "Close player panel",
  "library.episode_2": "Episode {p0}",
  "library.default_artwork": "· Default artwork",
  "library.no_artwork": "No artwork",
  "player.could_not_read_local_resources_try_again":
    "Could not read local resources. Try again later.",
  "player.video_output": "Video output",
  "player.hdr_processing": "HDR processing",
  "player.mpv_negotiates_with_the_current_display_automatically":
    "mpv negotiates with the current display automatically. SDR-to-HDR conversion is not enabled.",
  "player.unmodified_output_requires_system_and_display_support":
    "Unmodified output requires system and display support. Dolby Vision recognition does not guarantee full output for every profile; actual output depends on mpv negotiation.",
  "player.hardware_decoding": "Hardware decoding",
  "player.hardware_decoding_mode": "Hardware decoding mode",
  "player.auto_safe": "Auto (safe)",
  "player.audio_output": "Audio output",
  "player.audio_passthrough": "Audio passthrough",
  "player.auto_uses_pcm_when_device_capabilities_are":
    "Auto uses PCM when device capabilities are unverified. When enabled, only selected formats are requested.",
  "player.allowed_passthrough_formats": "Allowed passthrough formats",
  "player.audio_device": "Audio device",
  "player.if_the_device_is_unavailable_try_the":
    "If the device is unavailable, try the default device and PCM fallback.",
  "player.the_saved_device_is_unavailable_the_next":
    "The saved device is unavailable. The next playback will try an automatic fallback.",
  "player.refresh_audio_devices": "Refresh Audio Devices",
  "player.mpv_extensions": "mpv extensions",
  "player.external_configuration_is_disabled_by_default_when":
    "External configuration is disabled by default. When enabled, the order is quality settings → mpv.conf → extra arguments. Miry continues to manage sessions, authentication, and windows.",
  "player.could_not_open_the_configuration_folder":
    "Could not open the configuration folder.",
  "player.open_mpv_configuration_folder": "Open mpv Configuration Folder",
  "player.refresh_configuration_files": "Refresh Configuration Files",
  "player.use_custom_mpv_conf": "Use custom mpv.conf",
  "player.file_found": "File found",
  "player.place_mpv_conf_in_the_configuration_folder":
    "Place mpv.conf in the configuration folder; ignored if absent",
  "player.use_custom_input_conf": "Use custom input.conf",
  "player.place_input_conf_in_the_configuration_folder":
    "Place input.conf in the configuration folder; Miry shortcuts take priority",
  "player.extra_mpv_arguments": "Extra mpv arguments",
  "player.one_name_value_per_line_only_video":
    "One --name=value per line. Only video, audio, and subtitle adjustments are allowed; playback sessions, authentication, windows, and media output cannot be overridden.",
  "player.enable_custom_shaders": "Enable custom shaders",
  "player.place_valid_glsl_files_in_the_shaders":
    "Place valid .glsl files in the shaders subfolder. They are applied in the order below; no third-party algorithms are bundled.",
  "player.move_up": "Move {p0} up",
  "player.move_down": "Move {p0} down",
  "player.changes_apply_the_next_time_you_play":
    "Changes apply the next time you play media.",
  "player.current": "Current",
  "player.preparing_playback_or_syncing_progress":
    "Preparing playback or syncing progress…",
  "player.loading_upcoming_episodes": "Loading upcoming episodes…",
  "library.continue_watching_2": "Continue Watching · {p0}",
  "library.play_now": "Play Now",
  "library.quick_play": "Quick play {p0}",
  "library.quick_play_2": "Quick Play",
  "library.play_episode_from_beginning": "Play Episode from Beginning",
  "library.cancel_quick_play": "Cancel quick play",
  "library.your_last_playback_was_interrupted":
    "Your last playback was interrupted",
  "library.this_is_a_local_interrupted_playback_record":
    "This is a local interrupted playback record, separate from the server's Continue Watching. Connect to the same server before resuming.",
  "library.resume_interrupted_playback": "Resume Interrupted Playback",
  "library.dismiss_record": "Dismiss Record",
  "network.connection_address": "Connection address",
  "network.close_route_settings": "Close route settings",
  "network.route_selection": "Route selection",
  "network.manual_pinned": "Manual (pinned)",
  "network.auto_select_when_idle": "Auto-select (when idle)",
  "network.auto_select_uses_the_latest_recommendation_only":
    "Auto-select uses the latest recommendation only when idle. Playback issues show a warning; manually selected routes stay pinned.",
  "network.current": "· Current",
  "network.pinned": "· Pinned",
  "network.check": "Check {p0}",
  "network.test_throughput_for": "Test throughput for {p0}",
  "network.verify": "Verify {p0}",
  "network.use": "Use",
  "network.remove": "Remove {p0}",
  "network.route_name": "Route name",
  "network.local_remote_backup": "Local / Remote / Backup",
  "network.route_address": "Route address",
  "network.paste_connection_address": "Paste connection address",
  "network.verify_and_add": "Verify and Add",
  "network.cancel": "Cancel",
  "library.submit_media_search": "Submit media search",
  "library.search_media": "Search media",
  "library.search_movies_and_tv_shows": "Search movies and TV shows…",
  "library.clear_search_terms": "Clear search terms",
  "library.recent_searches": "Recent searches",
  "library.clear_history": "Clear History",
  "library.search_for": "Search for {p0}",
  "library.remove_search_history_for": "Remove search history for {p0}",
  "library.options": "Options",
  "settings.audio": "Audio",
  "settings.subtitles_danmaku": "Subtitles / Danmaku",
  "settings.network_routes": "Network / Routes",
  "settings.shortcuts": "Shortcuts",
  "settings.about": "About",
  "settings.client_permission_denied": "Client permission denied",
  "settings.hostname_lookup_failed": "Hostname lookup failed",
  "settings.could_not_connect": "Could not connect",
  "settings.tls_or_certificate_validation_failed":
    "TLS or certificate validation failed",
  "settings.request_timed_out": "Request timed out",
  "settings.server_returned_an_error": "Server returned an error",
  "settings.invalid_emby_data_format": "Invalid Emby data format",
  "settings.network_request_failed": "Network request failed",
  "settings.connected_ms": "Connected{p0} · {p1} ms",
  "settings.native_connection_ok_http_200_ms":
    "Native connection OK · HTTP 200 · {p0} ms",
  "settings.copy_diagnostics_for_details":
    "{p0}{p1}. Copy diagnostics for details.",
  "settings.connection_diagnostics_failed": "Connection diagnostics failed",
  "settings.native_diagnostics_could_not_be_completed_try":
    "Native diagnostics could not be completed. Try again later.",
  "settings.anonymous_diagnostics_copied_server_addresses_passwords_and":
    "Anonymous diagnostics copied. Server addresses, passwords, and tokens are excluded.",
  "settings.could_not_copy_diagnostics_check_clipboard_permissions":
    "Could not copy diagnostics. Check clipboard permissions.",
  "settings.close_settings": "Close settings",
  "settings.settings_categories": "Settings categories",
  "settings.playback_preferences": "Playback preferences",
  "settings.play_within_the_app": "Play within the app",
  "settings.when_off_use_a_separate_video_window":
    "When off, use a separate video window. Applies to the next playback.",
  "settings.intro_skip_duration_seconds": "Intro skip duration (seconds)",
  "settings.credits_skip_duration_seconds": "Credits skip duration (seconds)",
  "settings.auto_play_next_episode": "Auto-play next episode",
  "settings.continue_after_this_episode_finishes_and_progress":
    "Continue after this episode finishes and progress is synced",
  "settings.playback_compatibility_mode": "Playback compatibility mode",
  "settings.prefer_direct_play_by_default_negotiate_transcoding":
    "Prefer Direct Play by default; negotiate transcoding if no direct source is available",
  "settings.prefer_direct_play": "Prefer Direct Play",
  "settings.auto_server_source_order": "Auto (server source order)",
  "settings.direct_play_only": "Direct Play only",
  "settings.preferred_audio_language": "Preferred audio language",
  "settings.server_default": "Server default",
  "settings.chinese": "Chinese",
  "settings.english": "English",
  "settings.japanese": "Japanese",
  "settings.preferred_subtitle_language": "Preferred subtitle language",
  "settings.off_by_default": "Off by default",
  "settings.adjust_subtitle_size_delay_and_dual_subtitles":
    "Adjust subtitle size, delay, and dual subtitles in the player's Subtitle and Playback Settings menus.",
  "settings.initial_volume": "Initial volume",
  "settings.start_playback_in_fullscreen": "Start playback in fullscreen",
  "settings.preferences_are_saved_automatically_and_apply_to":
    "Preferences are saved automatically and apply to the next playback.",
  "settings.memory_cache_cleared": "Memory cache cleared.",
  "settings.clear_memory_cache": "Clear Memory Cache",
  "settings.local_danmaku": "Local danmaku",
  "settings.choose_a_bilibili_xml_or_ass_file":
    "Choose a Bilibili XML or ASS file under More → Danmaku in the embedded player. Each title and episode has its own file link.",
  "settings.server_connection": "Server connection",
  "settings.demo_mode_no_server_connected": "Demo mode · No server connected",
  "settings.manage_routes": "Manage Routes",
  "settings.manage_connection_routes_for_the_current_server":
    "Manage connection routes for the current server. Select automatically or pin a route manually.",
  "settings.checking": "Checking…",
  "settings.check_connection": "Check Connection",
  "settings.run_native_diagnostics": "Run Native Diagnostics",
  "settings.copy_connection_diagnostics": "Copy Connection Diagnostics",
  "player.player_shortcuts": "Player shortcuts",
  "player.select_a_key_field_and_press_a":
    "Select a key field and press a key. These Miry bindings take priority over input.conf; other keys go to input.conf / mpv. Playback shortcuts are suspended in inputs, sliders, menus, and settings.",
  "player.shortcut": "{p0} shortcut",
  "player.unassigned": "Unassigned",
  "player.this_shortcut_is_reserved_by_the_system":
    "This shortcut is reserved by the system and cannot be assigned.",
  "player.this_key_cannot_be_assigned_choose_another":
    "This key cannot be assigned. Choose another key or combination.",
  "player.this_key_is_already_assigned_to_another":
    "This key is already assigned to another action.",
  "player.delete_backspace_clears_a_binding_h_toggles":
    "Delete / Backspace clears a binding; H toggles the controls. Changes apply to the next playback.",
  "player.restore_default_shortcuts": "Restore Default Shortcuts",
  "library.sidebar": "Sidebar",
  "library.expand_sidebar": "Expand sidebar",
  "library.collapse_sidebar": "Collapse sidebar",
  "library.library": "Library · {p0}",
  "library.select_library": "Select library",
  "library.no_libraries": "No libraries",
  "library.loading_media": "Loading media",
  "player.the_adjustment_could_not_be_completed_try":
    "The adjustment could not be completed. Try again.",
  "library.dismiss_notification": "Dismiss notification",
  "library.video_surface": "Video surface",
  "settings.the_window_action_could_not_be_completed":
    "The window action could not be completed. Try again.",
  "settings.miry_title_bar": "Miry title bar",
  "settings.window_controls": "Window controls",
  "settings.minimize": "Minimize",
  "settings.minimize_window": "Minimize window",
  "settings.restore_window": "Restore window",
  "settings.maximize": "Maximize",
  "settings.maximize_window": "Maximize window",
  "settings.close_window": "Close window",
  "danmaku.danmaku_parsing_timed_out_check_the_file":
    "Danmaku parsing timed out. Check the file.",
  "danmaku.could_not_parse_the_danmaku_file":
    "Could not parse the danmaku file.",
  "danmaku.title_matches_not_enough_information":
    "Title matches; not enough information",
  "danmaku.original_title_matches_not_enough_information":
    "Original title matches; not enough information",
  "danmaku.similar_title": "Similar title",
  "danmaku.different_title_type": "Different title type",
  "danmaku.different_year": "Different year",
  "danmaku.tmdb_id_matches": "TMDb ID matches",
  "danmaku.title_and_year_match": "Title and year match",
  "danmaku.original_title_and_year_match": "Original title and year match",
  "danmaku.similar_title_year_matches": "Similar title; year matches",
  "danmaku.extra_content_confirm_manually": "Extra content; confirm manually",
  "danmaku.not_enough_season_or_episode_information":
    "Not enough season or episode information",
  "danmaku.different_episode": "Different episode",
  "danmaku.different_season": "Different season",
  "danmaku.not_enough_season_information": "Not enough season information",
  "danmaku.series_title_and_se_match": "Series title and S{p0}E{p1} match{p2}",
  "danmaku.first_season_not_specified": "(first season not specified)",
  "danmaku.different_series_title": "Different series title",
  "danmaku.could_not_connect_to_the_play_open":
    "Could not connect to the 弹弹play open danmaku network. Try again later.",
  "danmaku.the_play_service_is_unavailable_try_again":
    "The 弹弹play service is unavailable. Try again later.",
  "danmaku.the_play_service_is_rate_limited_try":
    "The 弹弹play service is rate-limited. Try again later.\nOnline danmaku is unavailable; video playback is unaffected.",
  "danmaku.no_matching_danmaku_title_found_try_a":
    "No matching danmaku title found. Try a manual search.",
  "danmaku.title_found_but_no_danmaku_is_available":
    "Title found, but no danmaku is available",
  "danmaku.the_data_returned_by_play_is_unavailable":
    "The data returned by 弹弹play is unavailable. Try again later.",
  "danmaku.online_request_cancelled_you_can_search_manually":
    "Online request cancelled. You can search manually.",
  "danmaku.online_danmaku_is_not_configured":
    "Online danmaku is not configured",
  "danmaku.this_match_is_no_longer_available_choose":
    "This match is no longer available. Choose another match.",
  "danmaku.invalid_xml_entity": "Invalid XML entity.",
  "danmaku.dtds_and_external_entities_are_not_allowed":
    "DTDs and external entities are not allowed in XML.",
  "danmaku.incomplete_xml_structure": "Incomplete XML structure.",
  "danmaku.data_found_outside_the_xml_root_element":
    "Data found outside the XML root element.",
  "danmaku.mismatched_xml_tags": "Mismatched XML tags.",
  "danmaku.more_than_100_000_danmaku_comments":
    "More than 100,000 danmaku comments.",
  "danmaku.multiple_xml_root_elements": "Multiple XML root elements.",
  "danmaku.invalid_xml_tag": "Invalid XML tag.",
  "danmaku.select_a_bilibili_xml_file": "Select a Bilibili XML file.",
  "danmaku.xml_nesting_is_too_deep": "XML nesting is too deep.",
  "danmaku.invalid_xml_attribute": "Invalid XML attribute.",
  "danmaku.xml_attributes_must_be_quoted": "XML attributes must be quoted.",
  "danmaku.invalid_xml_danmaku_structure": "Invalid XML danmaku structure.",
  "danmaku.text_found_outside_the_xml_root_element":
    "Text found outside the XML root element.",
  "danmaku.incomplete_xml_file": "Incomplete XML file.",
  "danmaku.invalid_ass_event_format": "Invalid ASS event format.",
  "danmaku.ass_file_has_no_events_data": "ASS file has no Events data.",
  "danmaku.the_danmaku_file_must_be_smaller_than":
    "The danmaku file must be smaller than 8 MiB.",
  "danmaku.only_xml_and_ass_files_are_supported":
    "Only XML and ASS files are supported.",
  "danmaku.matched_comments": "Matched: {p0} · {p1} · {p2} comments",
  "danmaku.local_files_take_priority_you_can_search":
    "Local files take priority. You can search for online danmaku manually.",
  "danmaku.online_danmaku_awaiting_a_match": "Online danmaku awaiting a match",
  "danmaku.automatic_matching_is_off_you_can_search":
    "Automatic matching is off. You can search manually.",
  "danmaku.matching": "Matching…",
  "danmaku.multiple_possible_matches_choose_one_to_confirm":
    "Multiple possible matches. Choose one to confirm.",
  "danmaku.no_match_found_try_just_the_title":
    "No match found · Try just the title or use the original title",
  "danmaku.online_matching_cancelled_you_can_search_manually":
    "Online matching cancelled. You can search manually.",
  "danmaku.credentials_file_unavailable_select_an_authorized_json":
    "Credentials file unavailable. Select an authorized JSON file.",
  "danmaku.searching": "Searching…",
  "danmaku.recommended_match_found_confirm_to_continue":
    "Recommended match found. Confirm to continue.",
  "danmaku.matched": "Matched: {p0}",
  "danmaku.the_file_contains_no_supported_scrolling_top":
    "The file contains no supported scrolling, top, or bottom comments.",
  "danmaku.danmaku_loaded_comments": "Danmaku loaded · {p0} comments{p1}",
  "danmaku.skipped": "· Skipped",
  "danmaku.unsupported_entries": "unsupported entries",
  "danmaku.choosing_a_danmaku_file": "Choosing a danmaku file…",
  "danmaku.danmaku_file_unlinked": "Danmaku file unlinked.",
  "player.the_server_returned_an_invalid_playback_url":
    "The server returned an invalid playback URL.",
  "player.playback_urls_must_use_http_or_https":
    "Playback URLs must use HTTP or HTTPS.",
  "player.the_server_did_not_provide_a_direct":
    "The server did not provide a Direct Stream URL.",
  "player.the_direct_stream_url_does_not_belong":
    "The Direct Stream URL does not belong to the current connection.",
  "player.the_server_returned_invalid_playback_information":
    "The server returned invalid playback information.",
  "player.the_server_could_not_prepare_playback":
    "The server could not prepare playback: {p0}",
  "player.no_media_source_available": "No media source available",
  "player.the_server_did_not_provide_a_transcoding":
    "The server did not provide a transcoding URL.",
  "player.this_media_cannot_be_played_directly_or":
    "This media cannot be played directly or with negotiated compatibility playback, or requires a dynamically opened media source.",
  "player.the_server_did_not_provide_a_complete":
    "The server did not provide a complete seekable compatibility stream. Select a direct source.",
  "player.the_server_did_not_return_a_valid":
    "The server did not return a valid playback session ID.",
  "player.subtitle_number": "Subtitle {p0}",
  "player.could_not_retrieve_playback_information_check_your":
    "Could not retrieve playback information{p0}. Check your connection and account permissions.",
  "player.the_server_returned_invalid_playback_information_2":
    "The server returned invalid playback information.",
  "player.the_server_did_not_provide_a_compatibility":
    "The server did not provide a compatibility playback URL.",
  "player.the_server_returned_an_invalid_compatibility_playback":
    "The server returned an invalid compatibility playback URL.",
  "player.could_not_load_the_episode_queue_the":
    "Could not load the episode queue. The current video can still play.",
  "player.no_playable_videos_in_this_list": "No playable videos in this list.",
  "player.could_not_load_the_next_episode_check":
    "Could not load the next episode. Check your connection and try again.",
  "player.season": "Season {p0} ·",
  "player.episode": "Episode {p0} ·",
  "player.no_playable_episodes_right_now_refresh_or":
    "No playable episodes right now. Refresh or select another season.",
  "player.repeated_request_timeouts": "Repeated request timeouts",
  "player.buffering_for_over_15_seconds": "Buffering for over 15 seconds",
  "player.input_throughput_stays_below_the_media_bitrate":
    "Input throughput stays below the media bitrate; insufficient buffer",
  "player.play_pause": "Play / Pause",
  "player.mute": "Mute",
  "player.subtitle_menu": "Subtitle menu",
  "player.audio_menu": "Audio menu",
  "player.unstable": "Unstable",
  "player.api_or_server_identity_checks_are_not":
    "API or server identity checks are not consistently passing",
  "player.api_time_to_first_byte_ms": "API time to first byte: {p0} ms",
  "player.sample_failure_rate": "Sample failure rate: {p0}%",
  "player.latency_variation_ms": "Latency variation: {p0} ms",
  "player.sample_throughput_mbps": "Sample throughput: {p0} Mbps{p1}",
  "player.including_headroom_for_the_current_bitrate":
    ", including headroom for the current bitrate",
  "player.media_throughput_is_untested_or_unreliable_recommendation":
    "Media throughput is untested or unreliable; recommendation is based on API checks only",
  "player.good": "Good",
  "player.fair": "Fair",
  "player.smart_route_requires_at_least_two_verified":
    "Smart Route requires at least two verified routes for the same server and account.",
  "player.route_quality_checks_require_the_windows_desktop":
    "Route quality checks require the Windows desktop app.",
  "player.wait_at_least_60_seconds_before_testing":
    "Wait at least 60 seconds before testing this route again.",
  "player.100_individual_dns_tcp_tls_stages_are":
    "{p0}/100 · {p1} · Individual DNS/TCP/TLS stages are unavailable (Unknown)",
  "network.default_route": "Default route",
  "network.current_route": "Current route",
  "network.the_current_and_default_routes_cannot_be":
    "The current and default routes cannot be removed.",
  "network.the_server_did_not_provide_an_identity":
    "The server did not provide an identity. Alternate routes cannot be verified yet.",
  "network.this_address_belongs_to_another_server_use":
    "This address belongs to another server. Use Add Server to sign in separately.",
  "network.the_account_identity_differs_on_this_route":
    "The account identity differs on this route. Sign in separately.",
  "library.featured_movies": "Featured movies",
  "library.weekend_picks": "Weekend picks",
  "library.season_1": "Season 1",
  "network.route_number": "Route {p0}",
  "library.connected": "Connected",
  "library.native_connection_ok": "Native connection OK",
  "settings.language": "Language",
  "settings.language_hint":
    "Interface language changes immediately and is kept after restart.",
  "library.page_number": "Page {page}",
  "library.episode_number": "Episode {episode}",
  "player.buffered_seconds": "Buffered {seconds} seconds",
  "library.items_count": "{count} {count, plural, one {item} other {items}}",
  "library.items_count_minimum":
    "At least {count} {count, plural, one {item} other {items}}",
  "library.favorites_count":
    "{count} {count, plural, one {favorite} other {favorites}}",
  "library.favorites_count_minimum":
    "At least {count} {count, plural, one {favorite} other {favorites}}",
  "library.results_count":
    "{count} {count, plural, one {result} other {results}}",
  "library.results_count_minimum":
    "At least {count} {count, plural, one {result} other {results}}",
  "danmaku.skipped_count":
    "Skipped {count} unsupported {count, plural, one {entry} other {entries}}",
  "errors.external": "The action could not be completed. {detail}",
  "errors.login": "Sign-in failed: {detail}",
  "errors.server_probe": "Server check failed: {detail}",
  "library.no_audio_devices_available": "No audio devices available",
  "errors.native_mpv_process_unavailable": "mpv process unavailable",
  "errors.native_could_not_create_player_process_protection":
    "Could not create player process protection",
  "errors.native_could_not_configure_player_process_protection":
    "Could not configure player process protection",
  "errors.native_could_not_attach_player_process_protection":
    "Could not attach player process protection",
  "errors.native_main_window_unavailable": "Main window unavailable",
  "errors.native_updates_are_managed_by_the_main_window":
    "Updates are managed by the main window",
  "errors.native_release_pages_are_managed_by_the_main":
    "Release pages are managed by the main window",
  "errors.native_could_not_open_the_release_page":
    "Could not open the release page",
  "errors.native_invalid_diagnostics_export_parameters":
    "Invalid diagnostics export parameters",
  "errors.native_documents_folder_unavailable": "Documents folder unavailable",
  "errors.native_diagnostics_folder_unavailable":
    "Diagnostics folder unavailable",
  "errors.native_could_not_encode_diagnostics": "Could not encode diagnostics",
  "errors.native_could_not_save_diagnostics": "Could not save diagnostics",
  "errors.native_invalid_danmaku_file_link": "Invalid danmaku file link",
  "errors.native_select_a_bilibili_xml_or_ass_file":
    "Select a Bilibili XML or ASS file.",
  "errors.native_danmaku_file_unavailable_choose_it_again_or":
    "Danmaku file unavailable. Choose it again or unlink it.",
  "errors.native_danmaku_file_unavailable": "Danmaku file unavailable",
  "errors.native_invalid_danmaku_file_encoding":
    "Invalid danmaku file encoding.",
  "errors.native_save_the_danmaku_file_as_utf_8":
    "Save the danmaku file as UTF-8 or UTF-16.",
  "errors.native_could_not_save_the_danmaku_file_link":
    "Could not save the danmaku file link",
  "errors.native_danmaku_files_are_managed_by_the_main":
    "Danmaku files are managed by the main window",
  "errors.native_could_not_locate_the_danmaku_file_link":
    "Could not locate the danmaku file link",
  "errors.native_could_not_open_the_file_picker":
    "Could not open the file picker",
  "errors.native_could_not_choose_danmaku": "Could not choose danmaku",
  "errors.native_this_version_supports_windows_only":
    "This version supports Windows only",
  "errors.native_could_not_read_the_danmaku_file_link":
    "Could not read the danmaku file link",
  "errors.native_choose_the_danmaku_file_again":
    "Choose the danmaku file again",
  "errors.native_invalid_server_address": "Invalid server address",
  "errors.native_use_an_http_s_server_address_without":
    "Use an HTTP(S) server address without credentials",
  "errors.native_could_not_initialize_network_diagnostics":
    "Could not initialize network diagnostics",
  "errors.native_player_controls_are_managed_by_the_main":
    "Player controls are managed by the main window",
  "errors.native_the_video_surface_is_managed_by_the":
    "The video surface is managed by the main window",
  "errors.native_invalid_controls_area": "Invalid controls area",
  "errors.native_could_not_resize_the_controls_area":
    "Could not resize the controls area",
  "errors.native_could_not_locate_the_application_folder":
    "Could not locate the application folder",
  "errors.native_bundled_mpv_was_not_found_reinstall_miry":
    "Bundled mpv was not found. Reinstall Miry.",
  "errors.native_playback_urls_must_come_from_the_current":
    "Playback URLs must come from the current Emby server.",
  "errors.native_invalid_playback_parameters": "Invalid playback parameters.",
  "errors.native_player_stopped": "Player stopped",
  "errors.native_player_connection_closed": "Player connection closed",
  "errors.native_player_response_timed_out": "Player response timed out",
  "errors.native_the_app_is_closing_playback_cannot_start":
    "The app is closing. Playback cannot start.",
  "errors.native_window_event_channel_unavailable":
    "Window event channel unavailable",
  "errors.native_player_has_not_started": "Player has not started",
  "errors.native_invalid_control_parameters": "Invalid control parameters",
  "errors.native_primary_and_secondary_subtitles_cannot_use_the":
    "Primary and secondary subtitles cannot use the same track",
  "errors.native_unsupported_player_action": "Unsupported player action",
  "errors.native_shortcuts_are_managed_by_the_main_window":
    "Shortcuts are managed by the main window.",
  "errors.native_invalid_key": "Invalid key",
  "errors.native_the_player_process_could_not_stop_try":
    "The player process could not stop. Try exiting again.",
  "errors.native_final_progress_sync_incomplete_the_player_has":
    "Final progress sync incomplete. The player has stopped.",
  "errors.native_could_not_start_mpv": "Could not start mpv",
  "errors.native_could_not_check_the_player_process":
    "Could not check the player process",
  "errors.native_mpv_exited_after_starting": "mpv exited after starting",
  "errors.native_connection_to_mpv_timed_out": "Connection to mpv timed out",
  "errors.native_this_player_supports_windows_only":
    "This player supports Windows only",
  "errors.native_could_not_send_the_player_command":
    "Could not send the player command",
  "errors.native_your_session_has_expired_sign_in_again":
    "Your session has expired. Sign in again.",
  "errors.native_the_server_denied_playback_check_your_permissions":
    "The server denied playback. Check your permissions.",
  "errors.native_media_url_not_found_refresh_the_media":
    "Media URL not found. Refresh the media information.",
  "errors.native_the_server_cannot_provide_video_right_now":
    "The server cannot provide video right now",
  "errors.native_media_request_failed": "Media request failed",
  "errors.native_the_player_does_not_support_this_protocol":
    "The player does not support this protocol.",
  "errors.native_could_not_load_video_check_the_media":
    "Could not load video. Check the media, network, and account permissions.",
  "errors.native_video_loading_or_decoding_failed_check_the":
    "Video loading or decoding failed. Check the media file, network, and playback permissions.",
  "errors.native_video_preparation_exceeded_30_seconds_the_player":
    "Video preparation exceeded 30 seconds. The player has stopped.",
  "errors.native_the_player_exited_before_loading_the_video":
    "The player exited before loading the video.",
  "errors.native_the_player_disconnected_or_exited_unexpectedly_start":
    "The player disconnected or exited unexpectedly. Start playback again.",
  "errors.native_playback_progress_sync_timed_out_check_your":
    "Playback progress sync timed out. Check your network.",
  "errors.legacy_progress_sync_failed":
    "Playback progress sync failed. Check your network.",
  "errors.native_playback_progress_sync_failed_run_native_connection":
    "Playback progress sync failed. Run native connection diagnostics in Settings.",
  "errors.native_playback_progress_cannot_be_synced_right_now":
    "Playback progress cannot be synced right now",
  "errors.native_final_playback_progress_sync_timed_out_the":
    "Final playback progress sync timed out. The player has stopped.",
  "errors.native_transcoding_session_cleanup_was_not_confirmed_check":
    "Transcoding session cleanup was not confirmed. Check the server.",
  "errors.native_invalid_route_address": "Invalid route address.",
  "errors.native_invalid_route_address_2": "Invalid route address",
  "errors.native_the_response_exceeded_the_test_limit":
    "The response exceeded the test limit.",
  "errors.native_test_response_interrupted": "Test response interrupted.",
  "errors.native_server_identity_missing_verify_the_route_first":
    "Server identity missing. Verify the route first.",
  "errors.native_could_not_initialize_the_route_test":
    "Could not initialize the route test.",
  "errors.native_invalid_address": "Invalid address",
  "errors.native_api_request_failed": "API request failed.",
  "errors.native_api_request_unsuccessful": "API request unsuccessful.",
  "errors.native_invalid_api_response_format": "Invalid API response format.",
  "errors.native_identity_mismatch": "Identity mismatch.",
  "errors.native_this_route_belongs_to_another_server_authentication":
    "This route belongs to another server. Authentication and media requests were blocked.",
  "errors.native_api_unverified_media_credentials_were_not_sent":
    "API unverified. Media credentials were not sent.",
  "errors.native_invalid_media_test_parameters":
    "Invalid media test parameters.",
  "errors.native_media_sample_request_failed": "Media sample request failed.",
  "errors.native_the_server_did_not_provide_a_valid":
    "The server did not provide a valid Range response. Media data was not read.",
  "errors.native_range_exceeded_the_test_limit_cancelled":
    "Range exceeded the test limit. Cancelled.",
  "errors.native_media_sample_length_mismatch": "Media sample length mismatch.",
  "errors.native_the_sample_is_too_short_for_a":
    "The sample is too short for a reliable throughput estimate.",
  "errors.native_sample_request_exceeded_4_seconds_cancelled":
    "Sample request exceeded 4 seconds. Cancelled.",
  "errors.native_route_tests_are_managed_by_the_main":
    "Route tests are managed by the main window.",
  "errors.native_another_route_test_is_running":
    "Another route test is running.",
  "errors.native_route_test_status_unavailable":
    "Route test status unavailable",
  "errors.native_test_status_unavailable": "Test status unavailable",
  "errors.native_route_test_cancelled": "Route test cancelled.",
  "errors.native_tests_are_managed_by_the_main_window":
    "Tests are managed by the main window.",
  "errors.native_status_unavailable": "Status unavailable",
  "errors.native_could_not_create_the_video_surface_use":
    "Could not create the video surface. Use a separate video window.",
  "errors.native_invalid_video_surface_parameters":
    "Invalid video surface parameters",
  "errors.native_could_not_resize_the_video_surface":
    "Could not resize the video surface",
  "errors.native_embedded_playback_is_unsupported_on_this_platform":
    "Embedded playback is unsupported on this platform",
  "errors.native_could_not_connect_to_the_video_window":
    "Could not connect to the video window",
  "errors.native_invalid_or_duplicate_shortcut_bindings":
    "Invalid or duplicate shortcut bindings.",
  "errors.native_playback_failed": "Playback failed: {detail}",
  "errors.native_direct_play_failed": "Direct Play failed: {detail}",
  "errors.native_direct_stream_failed": "Direct Stream failed: {detail}",
  "errors.native_transcoding_failed": "Transcoding failed: {detail}",
  "errors.native_the_player_rejected_the_action":
    "The player rejected the action: {detail}",
  "errors.native_the_server_did_not_accept_playback_progress":
    "The server did not accept playback progress ({status}).",
  "updates.available": "A new Miry version is available",
  "updates.signing_blocked":
    "Official update signing has not been confirmed. In-app download and installation are unavailable.",
  "updates.cancel_download": "Cancel download",
  "updates.cancelling": "Cancelling download",
  "updates.cancelled": "Download cancelled",
  "updates.cancel_failed":
    "The cancellation request failed. Waiting for the download to finish; installation will not continue.",
  "updates.downloading": "Downloading",
  "updates.verifying": "Verifying download",
  "updates.ready": "Ready to install",
  "updates.installing": "Starting installer",
  "updates.failed": "Download or verification failed",
  "updates.background": "Miry update ·",
  "updates.release_available": "A new version has been released.",
  "updates.download_progress": "Update download progress",
  "updates.verifying_signature": "Verifying update signature…",
  "updates.unknown_size": "Unknown size",
  "updates.unknown": "Unknown",
  "updates.signature_verified":
    "Update signature verified. Installation will safely stop playback and exit Miry, preserving your settings.",
  "updates.restart": "Restart Miry after installation",
  "updates.handoff":
    "Saving playback state and closing the player before handing over to the Windows installer.",
  "updates.update_now": "Update now",
  "updates.confirm": "Install update",
  "updates.download_background": "Download in background",
  "updates.install_later": "Install later",
  "updates.dismiss": "Not now",
  "settings.signed_updates_description":
    "An Emby + mpv client for Windows. Updates are downloaded and signature-verified in the app; you choose when to install.",
  "updates.offered":
    "The update is available. Close settings to continue; the prompt is deferred during playback.",
  "player.video_fit": "Video fit",
  "player.video_fit_help":
    "Fit shows the full image; fill may crop it; stretch may distort it.",
  "player.secondary_subtitle_scale": "Secondary subtitle size",
  "player.secondary_subtitle_position": "Adjust secondary subtitle position",
  "player.secondary_subtitle_help":
    "Adjust secondary subtitle size and vertical position independently; the default is at the top. Enable secondary subtitles to see the result. Bitmap subtitles retain their native position.",
  "danmaku.opacity_failed": "Could not change opacity. Try again.",
  "player.position_preview_failed": "Preview failed. Try again or cancel.",
  "player.position_save_failed":
    "Could not save the position. Try again or cancel.",
  "player.position_restore_failed":
    "Could not restore the position. Try cancelling again.",
  "player.secondary_subtitle_vertical": "Secondary subtitle vertical position",
  "player.secondary_subtitle_target": "↕ Secondary subtitle target ·",
  "player.secondary_position_help":
    "Drag vertically to preview the position, or use the arrow keys. Text subtitles retain native margins; bitmap subtitles cannot be moved.",
  "player.confirm_position": "Confirm position",
  "player.video_fit_default": "Fit (default)",
  "player.video_fit_fill": "Fill",
  "player.video_fit_stretch": "Stretch",
  "updates.download_failed": "Download failed. Try again.",
  "updates.install_failed":
    "Could not prepare or start installation. Download the update again and retry.",
  "danmaku.unconfigured_with_local":
    "Online danmaku is not configured. Video playback and local danmaku remain available",
  "tray.closeTitle": "When closing the window",
  "tray.closeDescription": "Choose how the close button and Alt+F4 behave",
  "tray.minimizeTitle": "When minimizing the window",
  "tray.minimizeDescription": "Choose how the minimize button behaves",
  "tray.exit": "Exit Miry",
  "tray.minimize": "Minimize normally",
  "tray.tray": "Hide to tray",
  "tray.hint":
    "Playback continues while hidden. Right-click the Miry tray icon to exit; normal close and minimize behavior is retained if the tray is unavailable.",
  "tray.show": "Show Miry",
  "tray.hide": "Hide Miry",
};

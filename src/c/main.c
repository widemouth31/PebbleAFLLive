#include <pebble.h>

#define MAX_GAMES 10
#define TITLE_LEN 40
#define SUBTITLE_LEN 80

enum {
  KEY_REQUEST_REFRESH = 0,
  KEY_MODE = 1,
  KEY_COUNT = 2,
  KEY_STATUS = 3,

  KEY_TITLE_0 = 10,
  KEY_SUBTITLE_0 = 11,
  KEY_TITLE_1 = 12,
  KEY_SUBTITLE_1 = 13,
  KEY_TITLE_2 = 14,
  KEY_SUBTITLE_2 = 15,
  KEY_TITLE_3 = 16,
  KEY_SUBTITLE_3 = 17,
  KEY_TITLE_4 = 18,
  KEY_SUBTITLE_4 = 19,
  KEY_TITLE_5 = 20,
  KEY_SUBTITLE_5 = 21,
  KEY_TITLE_6 = 22,
  KEY_SUBTITLE_6 = 23,
  KEY_TITLE_7 = 24,
  KEY_SUBTITLE_7 = 25,
  KEY_TITLE_8 = 26,
  KEY_SUBTITLE_8 = 27,
  KEY_TITLE_9 = 28,
  KEY_SUBTITLE_9 = 29,

  KEY_STATUSLINE_0 = 30,
  KEY_STATUSLINE_1 = 31,
  KEY_STATUSLINE_2 = 32,
  KEY_STATUSLINE_3 = 33,
  KEY_STATUSLINE_4 = 34,
  KEY_STATUSLINE_5 = 35,
  KEY_STATUSLINE_6 = 36,
  KEY_STATUSLINE_7 = 37,
  KEY_STATUSLINE_8 = 38,
  KEY_STATUSLINE_9 = 39
};

static Window *s_main_window;
static MenuLayer *s_menu_layer;

static char s_title_buffers[MAX_GAMES][TITLE_LEN];
static char s_subtitle_buffers[MAX_GAMES][SUBTITLE_LEN];
static char s_statusline_buffers[MAX_GAMES][SUBTITLE_LEN];

static char s_section_title[TITLE_LEN];

static int s_item_count = 0;

static void request_refresh(void);
static void request_toggle_mode(void);
static void set_status(const char *title, const char *subtitle);
static void update_menu_layer(void);

static uint16_t menu_get_num_sections_callback(MenuLayer *menu_layer, void *data);
static uint16_t menu_get_num_rows_callback(MenuLayer *menu_layer, uint16_t section_index, void *data);
static int16_t menu_get_header_height_callback(MenuLayer *menu_layer, uint16_t section_index, void *data);
static int16_t menu_get_cell_height_callback(MenuLayer *menu_layer, MenuIndex *cell_index, void *data);
static void menu_draw_header_callback(GContext *ctx, const Layer *cell_layer, uint16_t section_index, void *data);
static void menu_draw_row_callback(GContext *ctx, const Layer *cell_layer, MenuIndex *cell_index, void *data);
static void menu_select_click_callback(MenuLayer *menu_layer, MenuIndex *cell_index, void *data);
static void menu_select_long_click_callback(MenuLayer *menu_layer, MenuIndex *cell_index, void *data);

static void update_menu_layer(void) {
  if (s_menu_layer) {
    menu_layer_reload_data(s_menu_layer);
  }
}

static void set_status(const char *title, const char *subtitle) {
  snprintf(s_section_title, sizeof(s_section_title), "%s", title);

  snprintf(s_title_buffers[0], TITLE_LEN, "%s", title);
  snprintf(s_subtitle_buffers[0], SUBTITLE_LEN, "%s", subtitle);
  snprintf(s_statusline_buffers[0], SUBTITLE_LEN, "%s", "");
  s_item_count = 1;

  update_menu_layer();
}

static uint16_t menu_get_num_sections_callback(MenuLayer *menu_layer, void *data) {
  return 1;
}

static uint16_t menu_get_num_rows_callback(MenuLayer *menu_layer, uint16_t section_index, void *data) {
  return s_item_count;
}

static int16_t menu_get_header_height_callback(MenuLayer *menu_layer, uint16_t section_index, void *data) {
  return 22;
}

static int16_t menu_get_cell_height_callback(MenuLayer *menu_layer, MenuIndex *cell_index, void *data) {
  return 78;
}

static void menu_draw_header_callback(GContext *ctx, const Layer *cell_layer, uint16_t section_index, void *data) {
  GRect bounds = layer_get_bounds(cell_layer);

  graphics_context_set_text_color(ctx, GColorBlack);

  graphics_draw_text(
    ctx,
    s_section_title,
    fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD),
    bounds,
    GTextOverflowModeTrailingEllipsis,
    GTextAlignmentCenter,
    NULL
  );
}


static bool looks_like_score_text(const char *score) {
  int i;

  if (!score || score[0] == '\0') {
    return false;
  }

  for (i = 0; score[i] != '\0'; i++) {
    if ((score[i] >= '0' && score[i] <= '9') || score[i] == '-') {
      return true;
    }
  }

  return false;
}

static void draw_team_score_line(
  GContext *ctx,
  const char *text,
  GFont font,
  int y,
  int height,
  int width
) {
  char team[16];
  char score[40];
  const char *space;
  int team_len;

  memset(team, 0, sizeof(team));
  memset(score, 0, sizeof(score));

  if (!text || text[0] == '\0') {
    return;
  }

  space = strchr(text, ' ');

  /*
    Only split/right-align when the text actually looks like:
      TEAM SCORE
    Examples:
      CAR 12.9.81
      ESS 10.10.70
      COL -

    Do not split normal message rows like:
      No live games
      Currently in progress
  */
  if (space && looks_like_score_text(space + 1)) {
    team_len = space - text;

    if (team_len > (int)sizeof(team) - 1) {
      team_len = sizeof(team) - 1;
    }

    strncpy(team, text, team_len);
    team[team_len] = '\0';

    snprintf(score, sizeof(score), "%s", space + 1);

    /*
      Wider team column so 3-4 character abbreviations do not truncate.
      Old width was 44, which was too small for FONT_KEY_GOTHIC_28_BOLD.
    */
    graphics_draw_text(
      ctx,
      team,
      font,
      GRect(6, y, 62, height),
      GTextOverflowModeTrailingEllipsis,
      GTextAlignmentLeft,
      NULL
    );

    graphics_draw_text(
      ctx,
      score,
      font,
      GRect(68, y, width - 74, height),
      GTextOverflowModeTrailingEllipsis,
      GTextAlignmentRight,
      NULL
    );
  } else {
    graphics_draw_text(
      ctx,
      text,
      font,
      GRect(6, y, width - 12, height),
      GTextOverflowModeTrailingEllipsis,
      GTextAlignmentLeft,
      NULL
    );
  }
}


static void menu_draw_row_callback(GContext *ctx, const Layer *cell_layer, MenuIndex *cell_index, void *data) {
  int row;
  GRect bounds;
  GRect status_rect;
  bool highlighted;
  GFont title_font;
  GFont subtitle_font;
  GFont status_font;

  row = cell_index->row;

  if (row < 0 || row >= s_item_count) {
    return;
  }

  bounds = layer_get_bounds(cell_layer);

  highlighted = menu_cell_layer_is_highlighted(cell_layer);

  if (highlighted) {
    graphics_context_set_text_color(ctx, GColorWhite);
  } else {
    graphics_context_set_text_color(ctx, GColorBlack);
  }

  title_font = fonts_get_system_font(FONT_KEY_GOTHIC_28_BOLD);
  subtitle_font = fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD);
  status_font = fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD);

  draw_team_score_line(
    ctx,
    s_title_buffers[row],
    title_font,
    0,
    32,
    bounds.size.w
  );

  draw_team_score_line(
    ctx,
    s_subtitle_buffers[row],
    subtitle_font,
    28,
    28,
    bounds.size.w
  );

  status_rect = GRect(
    6,
    54,
    bounds.size.w - 12,
    24
  );

  graphics_draw_text(
    ctx,
    s_statusline_buffers[row],
    status_font,
    status_rect,
    GTextOverflowModeTrailingEllipsis,
    GTextAlignmentCenter,
    NULL
  );
}


static void menu_select_click_callback(MenuLayer *menu_layer, MenuIndex *cell_index, void *data) {
  APP_LOG(APP_LOG_LEVEL_INFO, "Select clicked - refresh");

  set_status("Refreshing...", "Fetching AFL scores");

  request_refresh();
}

static void menu_select_long_click_callback(MenuLayer *menu_layer, MenuIndex *cell_index, void *data) {
  APP_LOG(APP_LOG_LEVEL_INFO, "Select long-clicked - toggle mode");

  request_toggle_mode();
}

static void inbox_received_callback(DictionaryIterator *iter, void *context) {
  Tuple *status_tuple;
  Tuple *count_tuple;
  int count;
  int i;

  status_tuple = dict_find(iter, KEY_STATUS);
  count_tuple = dict_find(iter, KEY_COUNT);

  if (status_tuple && status_tuple->value->cstring[0] != '\0') {
    APP_LOG(APP_LOG_LEVEL_INFO, "Status from phone: %s", status_tuple->value->cstring);
    snprintf(s_section_title, sizeof(s_section_title), "%s", status_tuple->value->cstring);
  } else {
    snprintf(s_section_title, sizeof(s_section_title), "%s", "AFL Live");
  }

  count = 0;

  if (count_tuple) {
    count = (int)count_tuple->value->uint8;
  }

  if (count <= 0) {
    const char *msg = "No games found";

    if (status_tuple && status_tuple->value->cstring[0] != '\0') {
      msg = status_tuple->value->cstring;
    }

    set_status("AFL Live", msg);
    return;
  }

  if (count > MAX_GAMES) {
    count = MAX_GAMES;
  }

  for (i = 0; i < count; i++) {
    int title_key;
    int subtitle_key;
    Tuple *title_tuple;
    Tuple *subtitle_tuple;
    Tuple *statusline_tuple;
    title_key = KEY_TITLE_0 + (i * 2);
    subtitle_key = KEY_SUBTITLE_0 + (i * 2);
    
    title_tuple = dict_find(iter, title_key);
    subtitle_tuple = dict_find(iter, subtitle_key);
    statusline_tuple = dict_find(iter, KEY_STATUSLINE_0 + i);

    if (title_tuple && title_tuple->value->cstring[0] != '\0') {
      snprintf(s_title_buffers[i], TITLE_LEN, "%s", title_tuple->value->cstring);
    } else {
      snprintf(s_title_buffers[i], TITLE_LEN, "%s", "AFL Game");
    }

    if (subtitle_tuple && subtitle_tuple->value->cstring[0] != '\0') {
      snprintf(s_subtitle_buffers[i], SUBTITLE_LEN, "%s", subtitle_tuple->value->cstring);
    } else {
      snprintf(s_subtitle_buffers[i], SUBTITLE_LEN, "%s", "");
    }
    if (statusline_tuple && statusline_tuple->value->cstring[0] != '\0') {
      snprintf(s_statusline_buffers[i], SUBTITLE_LEN, "%s", statusline_tuple->value->cstring);
    } else {
      snprintf(s_statusline_buffers[i], SUBTITLE_LEN, "%s", "");
    }
  }

  s_item_count = count;

  update_menu_layer();
}

static void inbox_dropped_callback(AppMessageResult reason, void *context) {
  APP_LOG(APP_LOG_LEVEL_ERROR, "Inbox dropped message. Reason: %d", reason);

  set_status("Message error", "Inbox message dropped");
}

static void outbox_failed_callback(DictionaryIterator *iter, AppMessageResult reason, void *context) {
  APP_LOG(APP_LOG_LEVEL_ERROR, "Outbox send failed. Reason: %d", reason);
}

static void outbox_sent_callback(DictionaryIterator *iter, void *context) {
  APP_LOG(APP_LOG_LEVEL_INFO, "Outbox message sent");
}

static void request_refresh(void) {
  DictionaryIterator *iter;
  AppMessageResult result;

  result = app_message_outbox_begin(&iter);

  if (result != APP_MSG_OK) {
    APP_LOG(APP_LOG_LEVEL_ERROR, "Unable to begin refresh message. Result: %d", result);
    return;
  }

  dict_write_uint8(iter, KEY_REQUEST_REFRESH, 1);
  dict_write_end(iter);

  result = app_message_outbox_send();

  if (result != APP_MSG_OK) {
    APP_LOG(APP_LOG_LEVEL_ERROR, "Unable to send refresh message. Result: %d", result);
  }
}

static void request_toggle_mode(void) {
  DictionaryIterator *iter;
  AppMessageResult result;

  set_status("Switching view", "Please wait...");

  result = app_message_outbox_begin(&iter);

  if (result != APP_MSG_OK) {
    APP_LOG(APP_LOG_LEVEL_ERROR, "Unable to begin toggle message. Result: %d", result);
    return;
  }

  dict_write_uint8(iter, KEY_MODE, 1);
  dict_write_end(iter);

  result = app_message_outbox_send();

  if (result != APP_MSG_OK) {
    APP_LOG(APP_LOG_LEVEL_ERROR, "Unable to send toggle message. Result: %d", result);
  }
}

static void main_window_load(Window *window) {
  Layer *window_layer;
  GRect bounds;

  window_layer = window_get_root_layer(window);
  bounds = layer_get_bounds(window_layer);

  snprintf(s_section_title, sizeof(s_section_title), "%s", "AFL Live");

  s_menu_layer = menu_layer_create(bounds);

  menu_layer_set_callbacks(s_menu_layer, NULL, (MenuLayerCallbacks) {
    .get_num_sections = menu_get_num_sections_callback,
    .get_num_rows = menu_get_num_rows_callback,
    .get_header_height = menu_get_header_height_callback,
    .get_cell_height = menu_get_cell_height_callback,
    .draw_header = menu_draw_header_callback,
    .draw_row = menu_draw_row_callback,
    .select_click = menu_select_click_callback,
    .select_long_click = menu_select_long_click_callback
  });

  menu_layer_set_click_config_onto_window(s_menu_layer, window);

  layer_add_child(window_layer, menu_layer_get_layer(s_menu_layer));

  set_status("AFL Live", "Loading scores...");

  request_refresh();
}

static void main_window_unload(Window *window) {
  if (s_menu_layer) {
    menu_layer_destroy(s_menu_layer);
    s_menu_layer = NULL;
  }
}

static void init(void) {
  app_message_register_inbox_received(inbox_received_callback);
  app_message_register_inbox_dropped(inbox_dropped_callback);
  app_message_register_outbox_failed(outbox_failed_callback);
  app_message_register_outbox_sent(outbox_sent_callback);

  app_message_open(2048, 2048);

  s_main_window = window_create();

  window_set_window_handlers(s_main_window, (WindowHandlers) {
    .load = main_window_load,
    .unload = main_window_unload
  });

  window_stack_push(s_main_window, true);
}

static void deinit(void) {
  if (s_main_window) {
    window_destroy(s_main_window);
    s_main_window = NULL;
  }
}

int main(void) {
  init();
  app_event_loop();
  deinit();
}
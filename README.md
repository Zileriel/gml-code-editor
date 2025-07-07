TODO:
- implement middle click navigation to macro, enum, function declaration
- implement search & replace
- implement right-click context menus in the explorer to manage assets (create / delete)

FIX: 
- onClick: function() {
			other.toggle();
		},
( variable onClick is used but not declared )

- var x1 = instance.sprite_index == -1 ? instance.x - (box_size / 2) : instance.bbox_left;
(Comparison operator '==' used in assignment context. Did you mean '='?)

- draw_syntax_highlighted_text = function(input_text, x_pos, y_pos) {
( variable input_text is used but not defined)
( variable x_pos is used but not defined )
( variable y_pos is used but not defined )

- issues with local scope
var curPostNum = 0;
var myPosts = {};

var client = new Faye.Client(FAYE_URL, {
	timeout: 60
});

function get_post(num) {
	return $('li[name=q' + num + ']');
}

function make_reply_box() {
	var box = $('<li class="replylink"><a>[Reply]</a></li>');
	box.find('a').click(new_post_form);
	return box;
}

function insert_new_post_boxes() {
	$('ul:not(.newlink)').append(make_reply_box());
	$('hr').after('<ul class="newlink"><li><a>[New thread]</a></li></ul>');
	$('.replylink a, .newlink a').click(new_post_form);
}

function is_mine(msg) {
	return (msg.num == curPostNum || msg.num in myPosts);
}

function insert_post(msg) {
	if (is_mine(msg))
		return;
	var post = $(gen_post_html(msg));
	if (msg.op) {
		post.insertAfter('ul[name=thread' + msg.op
				+ '] li:not(.replylink):last');
		return;
	}
	var new_ul = $('<ul name="thread' + msg.num + '" />')
	new_ul.append(post).insertBefore('ul:not(.newlink):first');
	if (!curPostNum)
		new_ul.append(make_reply_box());
}

function update_post(msg) {
	if (is_mine(msg))
		return;
	var body = get_post(msg.num).addClass('editing').find('blockquote');
	body.append(document.createTextNode(msg.frag));
	body.html(body.html().replace(/\n/g, '<br>'));
}

function finish_post(msg) {
	if (is_mine(msg))
		return;
	get_post(msg.num).removeClass('editing');
}

client.subscribe('/thread/new', insert_post);
client.subscribe('/frag', update_post);
client.subscribe('/thread/done', finish_post);

function my_id() {
	/* XXX: temp */
	return Math.floor(Math.random() * 4e15 + 1);
}

function new_post_form() {
	var buffer = $('<p/>');
	var meta = $('<span><b/> <code/> <time/></span>');
	var posterName = $('input[name=name]').val().trim();
	var posterEmail = $('input[name=email]').val().trim();
	var input = $('<input name="body" class="trans"/>');
	var blockquote = $('<blockquote/>').append(buffer).append(input);
	var post = $('<li/>').append(meta).append(blockquote);
	var postOp = null;
	var dummy = $(document.createTextNode(' '));
	var sentAllocRequest = false, allocSubscription = null;
	var myId = my_id();
	var ul = $(this).parents('ul');

	var parsed = parse_name(posterName);
	meta.children('b').text(parsed[0]);
	meta.children('code').text(parsed[1] && '!?');
	if (posterEmail) {
		/* TODO: add link */
	}

	if (ul.hasClass('newlink'))
		ul.removeClass('newlink');
	else
		postOp = parseInt(ul.attr('name').replace('thread', ''));

	function got_allocation(msg) {
		var num = msg.num;
		allocSubscription.cancel();
		meta.children('b').text(msg.name);
		meta.children('code').text(msg.trip);
		meta.children('time').text(time_to_str(msg.time));
		curPostNum = num;
		myPosts[num] = 1;
		meta.append(' No.' + curPostNum);
		post.addClass('editing');
		post.attr('name', 'q' + num);
		if (!postOp)
			ul.attr('name', 'thread' + num);

		var submit = $('<input type="button" value="Done"/>')
		post.append(submit)
		submit.click(function () {
			/* transform into normal post */
			commit(input.val());
			input.remove();
			submit.remove();
			buffer.replaceWith(buffer.contents());
			post.removeClass('editing');

			curPostNum = 0;
			client.publish('/post/done', {id: myId, num: num});
			insert_new_post_boxes();
		});
	}
	function commit(text) {
		if (!curPostNum && !sentAllocRequest) {
			var msg = {
				id: myId,
				name: posterName,
				email: posterEmail,
				frag: text
			};
			if (postOp) msg.op = postOp;
			client.publish('/post/new', msg);
			allocSubscription = client.subscribe('/post/ok/'
					+ myId, got_allocation);
			sentAllocRequest = true;
		}
		else if (curPostNum) {
			/* TODO: Maybe buffer until allocation okayed? */
			client.publish('/post/frag',
				{id: myId, num: curPostNum, frag: text});
		}
		buffer.append(document.createTextNode(text));
	}
	function commit_words(text, spaceEntered) {
		var words = text.trim().split(/ +/);
		var endsWithSpace = text.length > 0
				&& text.charAt(text.length-1) == ' ';
		var newWord = endsWithSpace && !spaceEntered;
		if (newWord && words.length > 1) {
			input.val(words.pop() + ' ');
			commit(words.join(' ') + ' ');
		}
		else if (words.length > 2) {
			var last = words.pop();
			input.val(words.pop() + ' ' + last
					+ (endsWithSpace ? ' ' : ''));
			commit(words.join(' ') + ' ');
		}
	}
	input.attr('size', INPUT_MIN_SIZE);
	input.keydown(function (event) {
		var key = event.keyCode;
		if (key == 13) {
			commit(input.val() + '\n');
			buffer.append('<br>');
			input.val('');
			event.preventDefault();
		}
		else {
			commit_words(input.val(), key == 27);
		}
		var cur_size = input.attr('size');
		var right_size = Math.max(Math.round(input.val().length * 1.5),
				INPUT_MIN_SIZE);
		if (cur_size != right_size) {
			input.attr('size', (cur_size + right_size) / 2);
		}
	});
	/* do the switch */
	$(this).parent().replaceWith(dummy);
	$('.newlink, .replylink').remove();
	dummy.replaceWith(post);
	input.focus();
}

$(document).ready(function () {
	insert_new_post_boxes();
});

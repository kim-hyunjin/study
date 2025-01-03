package com.eomcs.lms.servlet;

import java.io.PrintStream;
import java.util.Map;
import org.springframework.stereotype.Component;
import com.eomcs.lms.domain.Board;
import com.eomcs.lms.service.BoardService;
import com.eomcs.util.RequestMapping;

@Component
public class BoardUpdateFormServlet {

  BoardService boardService;

  public BoardUpdateFormServlet(BoardService boardService) {
    this.boardService = boardService;
  }

  @RequestMapping("/board/updateForm")
  public void service(Map<String, String> params, PrintStream out) throws Exception {
    int no = Integer.parseInt(params.get("no"));
    Board board = boardService.get(no);

    out.println("<!DOCTYPE html>");
    out.println("<html>");
    out.println("<head>");
    out.println("<meta charset='UTF-8'>");
    out.println("<title>게시글 변경</title>");
    out.println("</head>");
    out.println("<body>");
    if (board == null) {
      out.println("<p>해당 번호의 게시글이 없습니다.</p>");
    } else {
      out.println("<form accept-charset='UTF-8' action='/board/update'>");
      out.printf("번호: <input readonly name='no' type='text' value='%d'><br>\n", board.getNo());
      out.printf("내용<br><textarea name='title' rows='5' cols='60'>%s</textarea><br>",
          board.getTitle());
      out.printf("등록일: %s<br>\n", board.getDate());
      out.printf("조회수: %d<br>\n", board.getViewCount());
      out.println("<button>변경</button>");
      out.println("</form>");
    }
    out.println("</body>");
    out.println("</html>");
  }
}

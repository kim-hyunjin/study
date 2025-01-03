package com.eomcs.lms.servlet;

import java.io.PrintStream;
import java.sql.Date;
import java.util.Map;
import org.springframework.stereotype.Component;
import com.eomcs.lms.domain.Lesson;
import com.eomcs.lms.service.LessonService;
import com.eomcs.util.RequestMapping;

@Component
public class LessonAddServlet {

  LessonService lessonService;

  public LessonAddServlet(LessonService lessonService) {
    this.lessonService = lessonService;
  }

  @RequestMapping("/lesson/add")
  public void service(Map<String, String> params, PrintStream out) throws Exception {
    Lesson lesson = new Lesson();
    lesson.setTitle(params.get("title"));
    lesson.setDescription(params.get("description"));
    lesson.setStartDate(Date.valueOf(params.get("startDate")));
    lesson.setEndDate(Date.valueOf(params.get("endDate")));
    lesson.setTotalHours(Integer.parseInt(params.get("totalHours")));
    lesson.setDayHours(Integer.parseInt(params.get("dayHours")));

    out.println("<!DOCTYPE html>");
    out.println("<html>");
    out.println("<head>");
    out.println("<meta charset='UTF-8'>");
    out.println("<meta http-equiv='refresh' content='2;url=/lesson/list'>");
    out.println("<title>수업 입력</title>");
    out.println("</head>");
    out.println("<body>");
    out.println("<h1>수업 입력 결과</h1>");
    if (lessonService.add(lesson) > 0) {
      out.println("<p>강의를 저장했습니다.</p>");
    } else {
      out.println("</p>저장에 실패했습니다.</p>");
    }
    out.println("</body>");
    out.println("</html>");
  }
}
